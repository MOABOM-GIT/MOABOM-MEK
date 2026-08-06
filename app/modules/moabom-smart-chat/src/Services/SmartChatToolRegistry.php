<?php

namespace Modules\Moabom\Smart\Chat\Services;

use App\Models\User;
use Illuminate\Support\Facades\Log;

/**
 * 툴 레지스트리 — function calling 스펙/실행 위임 + 턴별 컨텍스트 블록(생성앱) 조립.
 * 사이트 데이터·웹검색 모두 pull 방식 — LLM 이 필요할 때만 도구를 호출한다.
 * 모든 도구 호출은 감사 로그(moabom-smart-chat.tool_call)로 남는다.
 */
class SmartChatToolRegistry
{
    public const WEB_SEARCH_FUNCTION = 'search_web';

    public function __construct(
        private readonly SmartChatSiteToolService $siteTools,
        private readonly SmartChatWebSearchService $webSearch,
        private readonly SmartChatGeneratedAppContextService $generatedApps,
        private readonly SmartChatDataQueryService $dataQuery,
    ) {}

    /**
     * @return array{site_tools: list<string>, web_search_available: bool}
     */
    public function catalog(): array
    {
        return [
            'site_tools' => $this->siteTools->allowlist(),
            'web_search_available' => (bool) config('moabom-smart-chat.tools.web_search.enabled', true),
        ];
    }

    /**
     * LLM function calling 스펙 — 사이트 도구 + 범용 데이터 카탈로그 쿼리 + (허용 시) 웹검색.
     * 웹검색은 사용자 턴 토글이 ON 일 때만 스펙에 포함된다 (크레딧 서차지 동의 게이트).
     *
     * @return list<array{name: string, description: string, parameters: array<string, mixed>|null}>
     */
    public function functionSpecs(bool $webSearchAllowed = false): array
    {
        $specs = $this->siteTools->functionSpecs();
        if ($this->dataQuery->enabled()) {
            $spec = $this->dataQuery->functionSpec();
            if ($spec !== null) {
                $specs[] = $spec;
            }
        }
        if ($webSearchAllowed && (bool) config('moabom-smart-chat.tools.web_search.enabled', true)) {
            $specs[] = [
                'name' => self::WEB_SEARCH_FUNCTION,
                'description' => 'Search the public web for current or external information not available on the platform. '
                    .'Returns snippets with source URLs. Use only when platform data tools cannot answer.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'query' => [
                            'type' => 'string',
                            'description' => 'Web search query — concise keywords, not a full sentence.',
                        ],
                    ],
                    'required' => ['query'],
                ],
            ];
        }

        return $specs;
    }

    /**
     * 도구 실행 + 감사 로그 (누가·무엇을·얼마나·성공 여부).
     *
     * @param  array<string, mixed>  $args
     * @return array<string, mixed>
     */
    public function executeFunction(User $user, string $name, array $args): array
    {
        $startedAt = microtime(true);
        $result = $this->dispatchFunction($user, $name, $args);

        Log::info('moabom-smart-chat.tool_call', [
            'user_id' => $user->id,
            'tool' => $name,
            'args' => mb_substr((string) json_encode($args, JSON_UNESCAPED_UNICODE), 0, 300),
            'ok' => ! isset($result['error']),
            'duration_ms' => (int) round((microtime(true) - $startedAt) * 1000),
        ]);

        return $result;
    }

    /**
     * @param  array<string, mixed>  $args
     * @return array<string, mixed>
     */
    private function dispatchFunction(User $user, string $name, array $args): array
    {
        if ($name === self::WEB_SEARCH_FUNCTION) {
            $result = $this->webSearch->search(trim((string) ($args['query'] ?? '')));
            if (! $result['ok']) {
                return ['error' => 'no_results', 'query' => $result['query']];
            }

            return [
                'query' => $result['query'],
                'results' => $result['text'],
                'sources' => $result['sources'],
            ];
        }

        if ($name === SmartChatDataQueryService::FUNCTION_NAME) {
            return $this->dataQuery->execute($user, $args);
        }

        return $this->siteTools->executeFunction($user, $name, $args);
    }

    /**
     * 사용자가 명시적으로 지정한 컨텍스트만 조립 — 생성앱 Q&A.
     *
     * @return array{
     *   blocks: list<string>,
     *   used_tools: list<string>,
     *   generated_app: array<string, mixed>|null
     * }
     */
    public function assemble(User $user, ?int $generatedAppId): array
    {
        $blocks = [];
        $used = [];

        $generatedApp = null;
        if ($generatedAppId !== null && $generatedAppId > 0) {
            $ctx = $this->generatedApps->buildContext($user, $generatedAppId);
            if ($ctx['ok'] && $ctx['text'] !== '') {
                $blocks[] = $ctx['text'];
                $used[] = 'generated_app';
                $generatedApp = $ctx['app'];
            }
        }

        return [
            'blocks' => $blocks,
            'used_tools' => $used,
            'generated_app' => $generatedApp,
        ];
    }
}
