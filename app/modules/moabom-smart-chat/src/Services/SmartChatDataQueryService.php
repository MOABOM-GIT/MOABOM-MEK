<?php

namespace Modules\Moabom\Smart\Chat\Services;

use App\Extension\HookManager;
use App\Models\User;
use Illuminate\Database\Query\Builder;
use Throwable;

/**
 * 범용 플랫폼 데이터 조회 도구 — 데이터 카탈로그 + 구조화 쿼리 DSL (Phase 2).
 *
 * 질문 유형별 도구를 늘리지 않고, 선언적 리소스 카탈로그 위에서
 * LLM 이 구조화 쿼리(resource/select/filters/aggregates/group_by/order_by/limit)를 생성하면
 * 서버가 allowlist 검증 + 권한 스코프(본인/공개·테넌트)를 강제 주입해 실행한다.
 *
 * 확장: 다른 모듈은 `moabom.smart_chat.data_resources` 필터로 리소스를 등록한다.
 * 자유 SQL 은 허용하지 않는다 (멀티테넌트 격리·인젝션·풀스캔 방지).
 */
class SmartChatDataQueryService
{
    public const FUNCTION_NAME = 'query_platform_data';

    private const IDENT_RE = '/^[A-Za-z][A-Za-z0-9_]{0,39}$/';

    private const OPS = [
        'eq' => '=',
        'neq' => '!=',
        'gt' => '>',
        'gte' => '>=',
        'lt' => '<',
        'lte' => '<=',
        'like' => 'like',
    ];

    private const AGG_FNS = ['count', 'sum', 'avg', 'min', 'max'];

    private const GROUP_TRANSFORMS = ['date', 'month'];

    /** @var list<array<string, mixed>>|null */
    private ?array $resourcesCache = null;

    public function enabled(): bool
    {
        return (bool) config('moabom-smart-chat.tools.data_query.enabled', true)
            && $this->resources() !== [];
    }

    /**
     * LLM function spec — 리소스 카탈로그 요약을 description 에 포함.
     *
     * @return array{name: string, description: string, parameters: array<string, mixed>}|null
     */
    public function functionSpec(): ?array
    {
        $resources = $this->resources();
        if ($resources === []) {
            return null;
        }

        $lines = [];
        foreach ($resources as $r) {
            $lines[] = '- '.$r['name'].': '.$r['description'].' columns: '.implode(', ', $r['columns']);
        }

        $description = 'Query live platform data with a safe structured query. '
            .'Use for questions about platform records not covered by other tools '
            .'(top-N by rating/review count, per-day or per-month statistics, counts, recent lists). '
            ."Resources:\n".implode("\n", $lines)
            ."\nUse aggregates + group_by for statistics. "
            .'order_by may reference aggregate aliases (default alias: fn or fn_column, e.g. count, sum_amount).';

        return [
            'name' => self::FUNCTION_NAME,
            'description' => $description,
            'parameters' => [
                'type' => 'object',
                'properties' => [
                    'resource' => [
                        'type' => 'string',
                        'enum' => array_map(static fn (array $r) => $r['name'], $resources),
                    ],
                    'select' => [
                        'type' => 'array',
                        'items' => ['type' => 'string'],
                        'description' => 'Columns to return (omit for all allowed columns).',
                    ],
                    'filters' => [
                        'type' => 'array',
                        'items' => [
                            'type' => 'object',
                            'properties' => [
                                'column' => ['type' => 'string'],
                                'op' => ['type' => 'string', 'enum' => array_keys(self::OPS)],
                                'value' => [
                                    'type' => 'string',
                                    'description' => 'Comparison value as string. For like, include % wildcards. Dates as YYYY-MM-DD.',
                                ],
                            ],
                            'required' => ['column', 'op', 'value'],
                        ],
                    ],
                    'aggregates' => [
                        'type' => 'array',
                        'items' => [
                            'type' => 'object',
                            'properties' => [
                                'fn' => ['type' => 'string', 'enum' => self::AGG_FNS],
                                'column' => ['type' => 'string', 'description' => 'Column name, or * for count.'],
                                'as' => ['type' => 'string', 'description' => 'Optional result alias.'],
                            ],
                            'required' => ['fn', 'column'],
                        ],
                    ],
                    'group_by' => [
                        'type' => 'array',
                        'items' => [
                            'type' => 'object',
                            'properties' => [
                                'column' => ['type' => 'string'],
                                'transform' => [
                                    'type' => 'string',
                                    'enum' => self::GROUP_TRANSFORMS,
                                    'description' => 'Optional: date = group by day, month = group by month.',
                                ],
                            ],
                            'required' => ['column'],
                        ],
                    ],
                    'order_by' => [
                        'type' => 'array',
                        'items' => [
                            'type' => 'object',
                            'properties' => [
                                'column' => ['type' => 'string'],
                                'dir' => ['type' => 'string', 'enum' => ['asc', 'desc']],
                            ],
                            'required' => ['column'],
                        ],
                    ],
                    'limit' => ['type' => 'integer', 'description' => 'Max rows (1-50, default 20).'],
                ],
                'required' => ['resource'],
            ],
        ];
    }

    /**
     * 구조화 쿼리 실행 — 항상 배열 payload 반환 (실패 시 error 키, 스트림 유지).
     *
     * @param  array<string, mixed>  $args
     * @return array<string, mixed>
     */
    public function execute(User $user, array $args): array
    {
        try {
            return $this->executeUnsafe($user, $args);
        } catch (Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('moabom-smart-chat.data_query_failed', [
                'message' => $e->getMessage(),
                'resource' => is_string($args['resource'] ?? null) ? $args['resource'] : null,
            ]);

            return ['error' => 'query_failed'];
        }
    }

    /**
     * @param  array<string, mixed>  $args
     * @return array<string, mixed>
     */
    private function executeUnsafe(User $user, array $args): array
    {
        $resource = $this->findResource(is_string($args['resource'] ?? null) ? $args['resource'] : '');
        if ($resource === null) {
            return ['error' => 'unknown_resource', 'resources' => array_map(
                static fn (array $r) => $r['name'],
                $this->resources(),
            )];
        }

        /** @var list<string> $columns */
        $columns = $resource['columns'];
        /** @var Builder $query */
        $query = ($resource['query'])($user);

        // filters — allowlist 컬럼·연산자만, 값은 스칼라 캡
        $filters = is_array($args['filters'] ?? null) ? array_slice($args['filters'], 0, 8) : [];
        foreach ($filters as $filter) {
            if (! is_array($filter)) {
                continue;
            }
            $column = (string) ($filter['column'] ?? '');
            $op = (string) ($filter['op'] ?? '');
            if (! in_array($column, $columns, true) || ! isset(self::OPS[$op])) {
                return ['error' => 'invalid_filter', 'detail' => $column.' '.$op];
            }
            $value = $filter['value'] ?? null;
            if (! is_scalar($value)) {
                return ['error' => 'invalid_filter', 'detail' => $column.' value'];
            }
            $value = mb_substr((string) $value, 0, 200);
            // LLM 이 % 없이 like 값을 보내면 완전일치가 되어 0행 — 부분일치로 방어
            if ($op === 'like' && ! str_contains($value, '%')) {
                $value = '%'.$value.'%';
            }
            $query->where($column, self::OPS[$op], $value);
        }

        $aggregates = is_array($args['aggregates'] ?? null) ? array_slice($args['aggregates'], 0, 4) : [];
        $groupBy = is_array($args['group_by'] ?? null) ? array_slice($args['group_by'], 0, 3) : [];
        $maxRows = max(1, min(100, (int) config('moabom-smart-chat.tools.data_query.max_rows', 50)));
        $limit = isset($args['limit']) ? (int) $args['limit'] : 20;
        $limit = max(1, min($maxRows, $limit));

        $orderable = [];

        if ($aggregates !== []) {
            // 집계 모드 — select = group 식 + 집계 식
            $selects = [];
            foreach ($groupBy as $group) {
                if (! is_array($group)) {
                    continue;
                }
                $column = (string) ($group['column'] ?? '');
                $transform = isset($group['transform']) ? (string) $group['transform'] : '';
                if (! in_array($column, $columns, true) || ! preg_match(self::IDENT_RE, $column)) {
                    return ['error' => 'invalid_group_by', 'detail' => $column];
                }
                $expr = match ($transform) {
                    'date' => "DATE(`{$column}`)",
                    'month' => "DATE_FORMAT(`{$column}`, '%Y-%m')",
                    default => "`{$column}`",
                };
                if ($transform !== '' && ! in_array($transform, self::GROUP_TRANSFORMS, true)) {
                    return ['error' => 'invalid_group_by', 'detail' => $transform];
                }
                // alias = 컬럼명 그대로 — LLM 이 order_by 에서 자연스럽게 참조
                $selects[] = "{$expr} as `{$column}`";
                $query->groupByRaw($expr);
                $orderable[] = $column;
            }
            foreach ($aggregates as $agg) {
                if (! is_array($agg)) {
                    continue;
                }
                $fn = strtolower((string) ($agg['fn'] ?? ''));
                $column = (string) ($agg['column'] ?? '');
                if (! in_array($fn, self::AGG_FNS, true)) {
                    return ['error' => 'invalid_aggregate', 'detail' => $fn];
                }
                if ($column === '*') {
                    if ($fn !== 'count') {
                        return ['error' => 'invalid_aggregate', 'detail' => $fn.'(*)'];
                    }
                    $expr = 'COUNT(*)';
                    $defaultAlias = 'count';
                } elseif (in_array($column, $columns, true) && preg_match(self::IDENT_RE, $column)) {
                    $expr = strtoupper($fn)."(`{$column}`)";
                    $defaultAlias = $fn.'_'.$column;
                } else {
                    return ['error' => 'invalid_aggregate', 'detail' => $column];
                }
                $alias = is_string($agg['as'] ?? null) && preg_match(self::IDENT_RE, $agg['as'])
                    ? $agg['as']
                    : $defaultAlias;
                $selects[] = "{$expr} as `{$alias}`";
                $orderable[] = $alias;
            }
            $query->selectRaw(implode(', ', $selects));
        } else {
            // 목록 모드 — select 는 allowlist 부분집합
            $select = is_array($args['select'] ?? null) ? $args['select'] : [];
            $select = array_values(array_intersect(
                array_map(static fn ($v) => is_string($v) ? $v : '', $select),
                $columns,
            ));
            $query->select($select !== [] ? $select : $columns);
            $orderable = $columns;
        }

        $orderBy = is_array($args['order_by'] ?? null) ? array_slice($args['order_by'], 0, 3) : [];
        foreach ($orderBy as $order) {
            if (! is_array($order)) {
                continue;
            }
            $column = (string) ($order['column'] ?? '');
            if (! in_array($column, $orderable, true) || ! preg_match(self::IDENT_RE, $column)) {
                return ['error' => 'invalid_order_by', 'detail' => $column, 'orderable' => $orderable];
            }
            $dir = strtolower((string) ($order['dir'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';
            $query->orderByRaw("`{$column}` {$dir}");
        }

        $rows = $query->limit($limit)->get();

        $out = [];
        foreach ($rows as $row) {
            $assoc = (array) $row;
            foreach ($assoc as $key => $value) {
                if (is_string($value) && mb_strlen($value) > 300) {
                    $assoc[$key] = mb_substr($value, 0, 300).'…';
                }
            }
            $out[] = $assoc;
        }

        return [
            'resource' => $resource['name'],
            'row_count' => count($out),
            'rows' => $out,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function findResource(string $name): ?array
    {
        foreach ($this->resources() as $resource) {
            if ($resource['name'] === $name) {
                return $resource;
            }
        }

        return null;
    }

    /**
     * 카탈로그 — 내장 리소스 + `moabom.smart_chat.data_resources` 필터 등록분.
     * 각 리소스: name/description/columns(allowlist)/query(권한 스코프 강제된 base Builder 반환).
     *
     * @return list<array{name: string, description: string, columns: list<string>, query: callable(User): Builder}>
     */
    private function resources(): array
    {
        if ($this->resourcesCache !== null) {
            return $this->resourcesCache;
        }

        $resources = $this->builtinResources();

        try {
            $extended = HookManager::applyFilters('moabom.smart_chat.data_resources', $resources);
            if (is_array($extended)) {
                $resources = $extended;
            }
        } catch (Throwable) {
            // 필터 실패 시 내장 카탈로그만 사용
        }

        return $this->resourcesCache = array_values(array_filter(
            $resources,
            fn ($r) => $this->isValidResource($r),
        ));
    }

    private function isValidResource(mixed $resource): bool
    {
        if (! is_array($resource)) {
            return false;
        }
        if (! is_string($resource['name'] ?? null) || ! preg_match('/^[a-z][a-z0-9_]{1,39}$/', $resource['name'])) {
            return false;
        }
        if (! is_string($resource['description'] ?? null) || $resource['description'] === '') {
            return false;
        }
        if (! is_callable($resource['query'] ?? null)) {
            return false;
        }
        $columns = $resource['columns'] ?? null;
        if (! is_array($columns) || $columns === []) {
            return false;
        }
        foreach ($columns as $column) {
            if (! is_string($column) || ! preg_match(self::IDENT_RE, $column)) {
                return false;
            }
        }

        return true;
    }

    /**
     * 내장 리소스 — 소유 모듈이 없는 벤더 확장(sirsoft-board)만 대리 등록.
     * moabom-apps·moabom-credit 리소스는 각 모듈 프로바이더가
     * `moabom.smart_chat.data_resources` 필터로 직접 등록한다 (스키마 소유권 분산).
     *
     * @return list<array{name: string, description: string, columns: list<string>, query: callable(User): Builder}>
     */
    private function builtinResources(): array
    {
        $resources = [];

        if (class_exists(\Modules\Sirsoft\Board\Models\Post::class)) {
            $resources[] = [
                'name' => 'board_posts',
                'description' => 'Public community board posts — metadata only (no content), e.g. for counting posts per author.',
                'columns' => [
                    'id', 'board_id', 'user_id', 'author_name',
                    'view_count', 'comments_count', 'created_at',
                ],
                'query' => static function (User $user): Builder {
                    unset($user);

                    return \Modules\Sirsoft\Board\Models\Post::query()
                        ->where('status', 'published')
                        ->where('is_secret', false)
                        ->getQuery()
                        ->whereNull('deleted_at');
                },
            ];
        }

        return $resources;
    }
}
