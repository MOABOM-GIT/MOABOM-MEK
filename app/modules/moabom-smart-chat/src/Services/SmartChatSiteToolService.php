<?php

namespace Modules\Moabom\Smart\Chat\Services;

use App\Models\User;
use Throwable;

/**
 * 사이트 함수 도구 — LLM function calling 용 spec + 실행기 (pull 방식).
 * 데이터는 미리 주입하지 않고, LLM 이 필요할 때 호출하면 계정 권한 범위에서 조회해 반환한다.
 * 실행 실패는 error payload 로 돌려주고 스트림은 유지한다.
 */
class SmartChatSiteToolService
{
    public const TOOL_WEATHER = 'weather';

    public const TOOL_PROFILE = 'profile';

    public const TOOL_CREDIT = 'credit';

    public const TOOL_APPS = 'apps';

    public const ALL_TOOLS = [
        self::TOOL_PROFILE,
        self::TOOL_WEATHER,
        self::TOOL_CREDIT,
        self::TOOL_APPS,
    ];

    /** LLM-facing function name ↔ allowlist key */
    private const FUNCTION_MAP = [
        'get_my_profile' => self::TOOL_PROFILE,
        'get_weather' => self::TOOL_WEATHER,
        'get_my_credit' => self::TOOL_CREDIT,
        'get_popular_apps' => self::TOOL_APPS,
    ];

    /**
     * @return list<string>
     */
    public function allowlist(): array
    {
        $configured = (array) config('moabom-smart-chat.tools.site_allowlist', self::ALL_TOOLS);

        return array_values(array_intersect(self::ALL_TOOLS, $configured));
    }

    /**
     * allowlist 에 있는 도구만 provider-agnostic function spec 으로 반환.
     *
     * @return list<array{name: string, description: string, parameters: array<string, mixed>|null}>
     */
    public function functionSpecs(): array
    {
        $allowed = $this->allowlist();
        $specs = [];

        if (in_array(self::TOOL_PROFILE, $allowed, true)) {
            $specs[] = [
                'name' => 'get_my_profile',
                'description' => 'Get the current user\'s member profile (nickname, name, email, join date).',
                'parameters' => null,
            ];
        }
        if (in_array(self::TOOL_WEATHER, $allowed, true)) {
            $specs[] = [
                'name' => 'get_weather',
                'description' => 'Get current weather near the user (temperature, weather code, wind, PM2.5). Location is resolved automatically.',
                'parameters' => null,
            ];
        }
        if (in_array(self::TOOL_CREDIT, $allowed, true)) {
            $specs[] = [
                'name' => 'get_my_credit',
                'description' => 'Get the current user\'s platform credit: balance, totals earned/used, top spending days, recent transactions.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'lookback_days' => [
                            'type' => 'integer',
                            'description' => 'How many days back to analyze spending (default 90).',
                        ],
                    ],
                ],
            ];
        }
        if (in_array(self::TOOL_APPS, $allowed, true)) {
            $specs[] = [
                'name' => 'get_popular_apps',
                'description' => 'Get the platform\'s app popularity ranking (rank, title, kind: platform_app|generated_app, open hits, active time). Includes both built-in platform apps and user-generated apps.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'limit' => [
                            'type' => 'integer',
                            'description' => 'Number of ranked apps to return (1-30, default 10).',
                        ],
                    ],
                ],
            ];
        }

        return $specs;
    }

    /**
     * function 호출 실행 — 항상 배열 payload 반환 (실패 시 error 키).
     *
     * @param  array<string, mixed>  $args
     * @return array<string, mixed>
     */
    public function executeFunction(User $user, string $name, array $args): array
    {
        $tool = self::FUNCTION_MAP[$name] ?? null;
        if ($tool === null || ! in_array($tool, $this->allowlist(), true)) {
            return ['error' => 'unknown_tool'];
        }

        try {
            $data = match ($tool) {
                self::TOOL_PROFILE => $this->profileData($user),
                self::TOOL_WEATHER => $this->weatherData(),
                self::TOOL_CREDIT => $this->creditData($user, $args),
                self::TOOL_APPS => $this->appsData($args),
            };
        } catch (Throwable) {
            $data = null;
        }

        return $data ?? ['error' => 'unavailable'];
    }

    /**
     * @return array<string, mixed>
     */
    private function profileData(User $user): array
    {
        return array_filter([
            'nickname' => trim((string) ($user->nickname ?? '')) ?: null,
            'name' => trim((string) ($user->name ?? '')) ?: null,
            'email' => trim((string) ($user->email ?? '')) ?: null,
            'user_id' => (int) $user->id,
            'joined_at' => $user->created_at?->toDateString(),
        ], static fn ($v) => $v !== null);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function weatherData(): ?array
    {
        $lat = null;
        $lon = null;
        $lang = app()->getLocale() === 'ko' ? 'ko' : 'en';
        $request = request();

        if ($request !== null
            && interface_exists(\Plugins\Moabom\Weather\Contracts\IpGeolocationServiceInterface::class)
            && app()->bound(\Plugins\Moabom\Weather\Contracts\IpGeolocationServiceInterface::class)
        ) {
            /** @var \Plugins\Moabom\Weather\Contracts\IpGeolocationServiceInterface $geo */
            $geo = app(\Plugins\Moabom\Weather\Contracts\IpGeolocationServiceInterface::class);
            $loc = $geo->resolve($request);
            $lat = isset($loc['lat']) ? (float) $loc['lat'] : null;
            $lon = isset($loc['lon']) ? (float) $loc['lon'] : null;
        }

        if ($lat === null || $lon === null) {
            $fallback = (array) config('moabom-smart-chat.tools.weather_fallback', []);
            $lat = isset($fallback['lat']) ? (float) $fallback['lat'] : 37.5665;
            $lon = isset($fallback['lon']) ? (float) $fallback['lon'] : 126.9780;
        }

        if (! interface_exists(\Plugins\Moabom\Weather\Contracts\WeatherCurrentServiceInterface::class)
            || ! app()->bound(\Plugins\Moabom\Weather\Contracts\WeatherCurrentServiceInterface::class)
        ) {
            return null;
        }

        /** @var \Plugins\Moabom\Weather\Contracts\WeatherCurrentServiceInterface $weather */
        $weather = app(\Plugins\Moabom\Weather\Contracts\WeatherCurrentServiceInterface::class);
        $snap = $weather->fetch($lat, $lon, $lang);
        $arr = method_exists($snap, 'toArray') ? $snap->toArray() : [];

        return [
            'lat' => $lat,
            'lon' => $lon,
            'temperature_2m' => $arr['temperature_2m'] ?? null,
            'weather_code' => $arr['weather_code'] ?? null,
            'wind_speed_10m' => $arr['wind_speed_10m'] ?? null,
            'pm2_5' => $arr['pm2_5'] ?? null,
            'fetched_at' => $arr['fetched_at'] ?? null,
        ];
    }

    /**
     * 요청 계정 본인의 크레딧 — moabom-credit 미가용 시 null.
     *
     * @param  array<string, mixed>  $args
     * @return array<string, mixed>|null
     */
    private function creditData(User $user, array $args): ?array
    {
        if (! class_exists(\Modules\Moabom\Credit\Models\CreditTransaction::class)
            || ! class_exists(\Modules\Moabom\Credit\Models\CreditBalance::class)
        ) {
            return null;
        }

        $default = (int) config('moabom-smart-chat.tools.credit.lookback_days', 90);
        $lookbackDays = isset($args['lookback_days']) ? (int) $args['lookback_days'] : $default;
        $lookbackDays = max(7, min(365, $lookbackDays));

        $balanceRow = \Modules\Moabom\Credit\Models\CreditBalance::query()
            ->where('user_id', $user->id)
            ->first();

        $txQuery = \Modules\Moabom\Credit\Models\CreditTransaction::query()
            ->where('user_id', $user->id);

        $earned = (int) (clone $txQuery)->where('amount', '>', 0)->sum('amount');
        $used = (int) abs((clone $txQuery)->where('amount', '<', 0)->sum('amount'));

        $topSpendDays = (clone $txQuery)
            ->where('amount', '<', 0)
            ->where('created_at', '>=', now()->subDays($lookbackDays))
            ->selectRaw('DATE(created_at) as spend_date, SUM(-amount) as spent, COUNT(*) as tx_count')
            ->groupBy('spend_date')
            ->orderByDesc('spent')
            ->limit(5)
            ->get()
            ->map(static fn ($row) => [
                'date' => (string) $row->spend_date,
                'spent' => (int) $row->spent,
                'tx_count' => (int) $row->tx_count,
            ])
            ->all();

        $recent = (clone $txQuery)
            ->latest('id')
            ->limit(8)
            ->get()
            ->map(static fn ($tx) => [
                'date' => $tx->created_at?->toDateString(),
                'type' => is_object($tx->type) ? $tx->type->value : (string) $tx->type,
                'amount' => (int) $tx->amount,
                'description' => (string) ($tx->description ?? ''),
            ])
            ->all();

        return [
            'balance' => (int) ($balanceRow?->balance ?? 0),
            'ranking_points' => (int) ($balanceRow?->ranking_points ?? 0),
            'total_earned' => $earned,
            'total_used' => $used,
            'lookback_days' => $lookbackDays,
            'top_spend_days' => $topSpendDays,
            'recent_transactions' => $recent,
        ];
    }

    /**
     * 공개 앱 인기 랭킹 (shell rankings 캐시 재사용) — 미가용 시 null.
     *
     * @param  array<string, mixed>  $args
     * @return array<string, mixed>|null
     */
    private function appsData(array $args): ?array
    {
        if (! class_exists(\Modules\Moabom\System\Services\Shell\ShellRankingService::class)
            || ! app()->bound(\Modules\Moabom\System\Services\Shell\ShellRankingService::class)
        ) {
            return null;
        }

        $default = (int) config('moabom-smart-chat.tools.apps.ranking_limit', 10);
        $limit = isset($args['limit']) ? (int) $args['limit'] : $default;
        $limit = max(1, min(30, $limit));

        /** @var \Modules\Moabom\System\Services\Shell\ShellRankingService $rankings */
        $rankings = app(\Modules\Moabom\System\Services\Shell\ShellRankingService::class);
        $payload = $rankings->appRankings($limit);
        $items = is_array($payload['items'] ?? null) ? $payload['items'] : [];
        if ($items === []) {
            return ['items' => []];
        }

        // 셸 랭킹 app_id 는 문자열 셸 ID — 생성앱은 'generated-app-{id}', 그 외는 모듈 앱 레지스트리 id.
        // 생성앱 제목은 데이터 plane SSOT(GeneratedAppsConnection = platform DB)에서 조회한다.
        $generatedIds = [];
        foreach ($items as $row) {
            if (is_array($row) && preg_match('/^generated-app-(\d+)$/', (string) ($row['app_id'] ?? ''), $m)) {
                $generatedIds[] = (int) $m[1];
            }
        }
        $generatedTitles = [];
        if ($generatedIds !== [] && class_exists(\Modules\Moabom\Apps\Support\GeneratedAppsConnection::class)) {
            $generatedTitles = \Modules\Moabom\Apps\Support\GeneratedAppsConnection::apps()
                ->whereIn('id', $generatedIds)
                ->pluck('title', 'id')
                ->all();
        }
        $registryNames = [];
        if (interface_exists(\Modules\Moabom\Apps\Apps\AppRegistryInterface::class)
            && app()->bound(\Modules\Moabom\Apps\Apps\AppRegistryInterface::class)
        ) {
            $locale = app()->getLocale();
            foreach (app(\Modules\Moabom\Apps\Apps\AppRegistryInterface::class)->all() as $manifest) {
                // 매니페스트 name 은 i18n 맵(array) 또는 문자열 — 배열이면 로캘 우선 해석
                $name = $manifest->name;
                if (is_array($name)) {
                    $first = reset($name);
                    $name = $name[$locale] ?? $name['ko'] ?? $name['en'] ?? (is_string($first) ? $first : '');
                }
                $registryNames[(string) $manifest->id] = (string) $name;
            }
        }

        $rows = [];
        foreach ($items as $row) {
            if (! is_array($row)) {
                continue;
            }
            $shellId = (string) ($row['app_id'] ?? '');
            if (preg_match('/^generated-app-(\d+)$/', $shellId, $m)) {
                $kind = 'generated_app';
                $title = (string) ($generatedTitles[(int) $m[1]] ?? '');
            } else {
                $kind = 'platform_app';
                $title = (string) ($registryNames[$shellId] ?? $shellId);
            }
            $rows[] = [
                'rank' => (int) ($row['rank'] ?? 0),
                'app_id' => $shellId,
                'kind' => $kind,
                'title' => $title,
                'open_hits' => (int) ($row['open_hits'] ?? 0),
                'active_seconds' => (int) ($row['active_seconds'] ?? 0),
                'change' => (string) ($row['change'] ?? 'same'),
            ];
        }

        return [
            'generated_at' => $payload['generated_at'] ?? null,
            'items' => $rows,
        ];
    }
}
