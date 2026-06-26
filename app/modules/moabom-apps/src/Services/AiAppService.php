<?php

namespace Modules\Moabom\Apps\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Modules\Moabom\Apps\Contracts\GeneratedAppRepositoryInterface;
use Modules\Moabom\Apps\Enums\AppTier;
use Modules\Moabom\Apps\Enums\GeneratedAppVisibility;
use Modules\Moabom\Apps\Models\GeneratedApp;
use Modules\Moabom\Apps\Support\GeneratedAppOwnerResolver;
use Modules\Moabom\Apps\Support\GeneratedAppPublishPolicy;

class AiAppService
{
    public function __construct(
        private readonly GeneratedAppRepositoryInterface $appRepository,
        private readonly GeneratedAppHtmlService $htmlService,
        private readonly GeneratedAppPreviewService $previewService,
        private readonly GeneratedAppHostingService $hostingService,
        private readonly GeneratedAppOwnerResolver $ownerResolver,
        private readonly GeneratedAppPurgeService $purgeService,
        private readonly WebsiteLinkIconStorageService $websiteLinkIconStorage,
    ) {
    }

    private const HOSTED_STATIC_PROMPT = <<<'PROMPT'

HOSTED APP RULES (dedicated app origin — app server storage):
- Personal data only: each signed-in member has isolated storage. Never mix users.
- Read window.__MOABOM_APP_RUNTIME__ for appId, userId, tenantSlug, storagePrefix.
- Data API: fetch('/api/data/{table_key}') on the same origin as this page.
- ALL data requests (GET/POST/PUT/DELETE) require header X-Moabom-Preview-Token with preview_token from the page URL query.
- Use stable snake_case table_key names. Never call the Moabom shell API from inside the app.
PROMPT;

    private const STANDARD_STORAGE_PROMPT = <<<'PROMPT'

STANDARD APP STORAGE (device localStorage):
- When window.__MOABOM_APP_RUNTIME__ exists, prefix EVERY localStorage key with storagePrefix from runtime.
- Without runtime context, do not persist personal data in localStorage.
PROMPT;

    /**
     * 앱 타입별 시스템 프롬프트입니다.
     *
     * @var array<string, string>
     */
    private const SYSTEM_PROMPTS = [
        'general' => self::COMMON_STATIC_PROMPT."\n\nAPP TYPE: General Web App\n- Focus on clean, responsive HTML/CSS/vanilla JavaScript UI\n- Use modern CSS (Flexbox, Grid)\n- Ensure mobile compatibility\n- For long lists/content: add overflow-y: auto with max-height\n- Review layout order, closed tags, and JavaScript errors before output.",
        '3d' => self::COMMON_STATIC_PROMPT."\n\nAPP TYPE: 3D Canvas with Three.js\n- Use Three.js 0.184.0 from jsDelivr: https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js\n- Load it with <script type=\"module\"> and `import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js';`; do not use the removed global THREE build\n- Dispose geometries/materials/textures on cleanup\n- Keep scene objects and polygon counts modest\n- Use a safe animation loop and cancelAnimationFrame on error.",
        'game' => self::COMMON_STATIC_PROMPT."\n\nAPP TYPE: Phaser Interaction Canvas\n- Use Phaser 4.1.0 from jsDelivr: https://cdn.jsdelivr.net/npm/phaser@4.1.0/dist/phaser.min.js\n- Include it with a normal <script src=\"https://cdn.jsdelivr.net/npm/phaser@4.1.0/dist/phaser.min.js\"></script> before app code\n- Prefer business-friendly simulations, process trainers, interactive dashboards, quizzes, and workflow tools over arcade game framing\n- Limit entities and use delta time\n- Provide restart/error handling\n- Clean up timers, sprites, and input listeners.",
        'dataviz' => self::COMMON_STATIC_PROMPT."\n\nAPP TYPE: Data Visualization with Chart.js\n- Use Chart.js 4.5.1 UMD from jsDelivr: https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js\n- Include it with <script src=\"https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js\"></script> before chart code\n- Keep a single chart instance and destroy before recreating\n- Validate data and limit data points\n- Chart containers must have an explicit safe height.",
    ];

    private const COMMON_STATIC_PROMPT = <<<'PROMPT'
You are an expert web developer for the MOABOM platform.

CRITICAL OUTPUT RULES:
- Return ONLY the raw HTML code. No markdown, no code blocks, no explanations.
- Start directly with <!DOCTYPE html>.
- Use a complete HTML5 document with html, head, and body.
- All tags must be properly closed.
- Single file with inline CSS and JavaScript.
- Use CDN for external libraries when needed.

SCROLL & OVERFLOW RULES:
- Always ensure content is scrollable when it exceeds viewport.
- Set proper overflow properties on containers.
- For long content, use overflow-y: auto or overflow-y: scroll.
- For body/html, ensure height/min-height and overflow are safe.

ICON RULES:
- Do not use emoji characters.
- Use Remix Icon and include:
  <link href="https://cdn.jsdelivr.net/npm/remixicon@4.8.0/fonts/remixicon.min.css" rel="stylesheet">

INTERNAL NAVIGATION RULES (multi-section / tab menus):
- Use in-page hash links only: href="#section-id" (never full URLs like https://... or /app/...).
- Never use <base href="...">.
- Give each section a matching id attribute (e.g. <section id="stages">).
- Toggle visibility with CSS/JS on hashchange or click; do not navigate the parent window.
- Prefer a single-page layout; avoid separate HTML files or path-based routes.

PWA / SERVICE WORKER RULES (MOABOM runs inside a sandboxed iframe):
- Never use navigator.serviceWorker, service worker registration, or web app manifests.
- Do not include <link rel="manifest">.
- Do not depend on localStorage/sessionStorage for critical navigation state.

SELF-REVIEW BEFORE OUTPUT:
- Check valid DOM order, no overlapping tags, no unclosed style/script tags.
- Check responsive design and mobile layout.
- Check JavaScript functions are defined before use.
- Add try/catch around interactive JavaScript and show a user-friendly retry action on error.
- Prevent infinite loops and memory leaks.
PROMPT;

    /**
     * @return array{provider: string, model: string}
     */
    public function resolveModelConfig(string $modelId): array
    {
        return $this->resolveModel($modelId);
    }

    public function systemPromptForType(string $appType, ?string $tier = null): string
    {
        $prompt = $this->systemPrompt($appType);
        if (AppTier::tryFrom((string) ($tier ?? AppTier::Standard->value)) === AppTier::Hosted) {
            $prompt .= self::HOSTED_STATIC_PROMPT;
        } else {
            $prompt .= self::STANDARD_STORAGE_PROMPT;
        }

        return $prompt;
    }

    /**
     * OpenAI Chat Completions payload를 구성합니다.
     *
     * GPT-5.1 Chat 계열은 temperature 기본값(1)만 허용하므로 명시 전송하지 않습니다.
     *
     * @param  array<int, array{role: string, content: string}>  $messages
     * @return array<string, mixed>
     */
    public function buildOpenAiChatPayload(string $model, array $messages, bool $stream = false): array
    {
        $payload = [
            'model' => $model,
            'messages' => $messages,
            'max_completion_tokens' => $this->maxOutputTokens(),
        ];

        if ($stream) {
            $payload['stream'] = true;
        }

        $temperature = $this->openAiTemperature($model);
        if ($temperature !== null) {
            $payload['temperature'] = $temperature;
        }

        return $payload;
    }

    /**
     * @param  array{prompt: string, app_type: string, model_id: string, current_html?: string|null}  $data
     */
    public function buildStreamUserPrompt(array $data, bool $continue, string $partialRaw): string
    {
        $mode = $this->generationMode($data, $continue, $partialRaw);

        if ($mode === 'append') {
            $extra = trim((string) ($data['prompt'] ?? ''));
            $instruction = $extra !== ''
                ? $extra
                : (string) __('moabom-apps::messages.apps.ai.continue_default_prompt');

            return sprintf(
                "다음 HTML 문서는 중간에 끊겼습니다. 목표는 이미 작성된 앞부분을 반복하지 않고, 문서 끝에 이어 붙일 나머지 HTML suffix만 출력하는 것입니다.\n\n규칙:\n- 기존 문서 앞부분을 절대 다시 출력하지 마세요.\n- 출력은 이어 붙일 새 코드 조각만 포함하세요.\n- 필요한 경우 현재 열린 태그를 닫고, 최종적으로 </body>와 </html>까지 완성하세요.\n- 마크다운 코드블록이나 설명은 금지합니다.\n\n이어하기 지시: %s\n\n문서 전체 길이: %d bytes\n마지막 문맥:\n```html\n%s\n```",
                $instruction,
                strlen($partialRaw),
                $this->tailContext($partialRaw)
            );
        }

        if ($mode === 'patch') {
            $currentHtml = trim((string) ($data['current_html'] ?? ''));

            return sprintf(
                "아래 기존 HTML 앱을 사용자의 수정 요청에 맞게 최소 변경 패치로 수정해야 합니다.\n\n중요 규칙:\n- 전체 HTML을 다시 출력하지 마세요.\n- 변경이 필요한 부분만 패치로 출력하세요.\n- SEARCH는 기존 HTML에서 정확히 한 번 나타나는 원문 조각이어야 합니다.\n- 한 번에 적용 가능한 작은 변경만 출력하세요. 추측으로 같은 영역을 반복 수정하지 마세요.\n- 정확히 다음 형식만 사용하세요. 설명/마크다운 금지.\n\n<<<MOABOM_PATCH>>>\n---SEARCH---\n기존 HTML에서 정확히 한 번 나타나는 원문 조각\n---REPLACE---\n교체할 새 조각\n---SEARCH---\n다음 원문 조각\n---REPLACE---\n다음 교체 조각\n<<<END_PATCH>>>\n\n수정 요청: %s\n\n기존 HTML:\n```html\n%s\n```",
                trim((string) ($data['prompt'] ?? '')),
                $currentHtml
            );
        }

        return $this->buildPrompt($data);
    }

    /**
     * @return array<string, mixed>
     */
    public function buildStreamResult(
        array $data,
        string $content,
        string $provider,
        string $model,
        bool $truncated,
        ?string $finishReason,
    ): array {
        if ($content === '' || in_array($finishReason, ['no_key', 'error'], true)) {
            $mode = $this->generationMode($data, false, $content);
            if ($mode === 'patch' && trim((string) ($data['current_html'] ?? '')) !== '') {
                $noticeKey = match ($provider) {
                    'anthropic' => $finishReason === 'no_key' ? 'anthropic_no_key' : 'anthropic_failed',
                    'google' => $finishReason === 'no_key' ? 'google_no_key' : 'google_failed',
                    default => $finishReason === 'no_key' ? 'openai_no_key' : 'openai_failed',
                };
                $currentHtml = (string) $data['current_html'];

                return array_merge(
                    $this->htmlResult($data, $currentHtml, $provider, $model),
                    [
                        'fallback' => true,
                        'truncated' => false,
                        'finish_reason' => $finishReason,
                        'notice' => __('moabom-apps::messages.apps.ai.notice.'.$noticeKey),
                        'raw' => $currentHtml,
                    ],
                );
            }

            $noticeKey = match ($provider) {
                'anthropic' => $finishReason === 'no_key' ? 'anthropic_no_key' : 'anthropic_failed',
                'google' => $finishReason === 'no_key' ? 'google_no_key' : 'google_failed',
                default => $finishReason === 'no_key' ? 'openai_no_key' : 'openai_failed',
            };
            $notice = match ($finishReason) {
                'no_key', 'error' => __('moabom-apps::messages.apps.ai.notice.'.$noticeKey),
                default => null,
            };
            $fallback = $this->fallbackHtml($data, $notice);

            return array_merge($fallback, [
                'truncated' => false,
                'finish_reason' => $finishReason,
                'raw' => '',
            ]);
        }

        $mode = $this->generationMode($data, false, $content);
        $html = $mode === 'patch'
            ? $this->applyPatchResponse((string) ($data['current_html'] ?? ''), $content)
            : $this->extractHtml($content);
        if ($html === '') {
            if ($truncated && $content !== '') {
                return [
                    'html' => '',
                    'model_id' => $data['model_id'],
                    'provider' => $provider,
                    'fallback' => false,
                    'truncated' => true,
                    'finish_reason' => $finishReason,
                    'raw' => $content,
                ];
            }

            $fallback = $mode === 'patch' && trim((string) ($data['current_html'] ?? '')) !== ''
                ? $this->htmlResult($data, (string) $data['current_html'], $provider, $model)
                : $this->fallbackHtml($data);

            return array_merge($fallback, [
                'truncated' => $truncated,
                'finish_reason' => $finishReason,
                'raw' => $mode === 'patch' ? (string) ($data['current_html'] ?? $content) : $content,
            ]);
        }

        return array_merge(
            $this->htmlResult($data, $html, $provider, $model),
            [
                'truncated' => $truncated,
                'finish_reason' => $finishReason,
                'raw' => $mode === 'patch' ? $content : $html,
            ],
        );
    }

    /**
     * AI 앱 HTML을 생성합니다.
     *
     * @param  array{prompt: string, app_type: string, model_id: string, current_html?: string|null}  $data
     * @return array<string, mixed>
     */
    public function generate(array $data): array
    {
        $provider = (string) config('moabom-apps.ai.provider', 'disabled');
        if ($provider === 'disabled' || $provider === '') {
            if ($this->generationMode($data, false, '') === 'patch' && trim((string) ($data['current_html'] ?? '')) !== '') {
                return array_merge(
                    $this->htmlResult($data, (string) $data['current_html'], 'fallback', 'fallback'),
                    [
                        'fallback' => true,
                        'notice' => __('moabom-apps::messages.apps.ai.notice.default'),
                        'raw' => (string) $data['current_html'],
                    ],
                );
            }

            return $this->fallbackHtml($data);
        }

        $model = $this->resolveModel($data['model_id']);
        $resolvedProvider = $provider === 'auto' ? $model['provider'] : $provider;

        return match ($resolvedProvider) {
            'anthropic' => $this->generateWithAnthropic($data, $model['model']),
            'openai' => $this->generateWithOpenAi($data, $model['model']),
            'google' => $this->generateWithGoogle($data, $model['model']),
            default => $this->fallbackHtml($data),
        };
    }

    /**
     * 생성 앱을 저장합니다.
     *
     * @param  array<string, mixed>  $data
     */
    public function store(int $userId, array $data): GeneratedApp
    {
        $parentAppId = $this->visibleParentAppId($userId, $data['parent_app_id'] ?? null);
        $tier = AppTier::tryFrom((string) ($data['tier'] ?? AppTier::Standard->value)) ?? AppTier::Standard;

        $app = $this->appRepository->create([
            'user_id' => $userId,
            'title' => $data['title'],
            'app_type' => $data['app_type'],
            'tier' => $tier->value,
            'model_id' => $data['model_id'] ?? null,
            'prompt' => $data['prompt'] ?? null,
            'html' => $this->htmlService->harden((string) $data['html']),
            'visibility' => $this->resolveVisibility($data['visibility'] ?? $data['is_shared'] ?? false),
            'parent_app_id' => $parentAppId,
            'version' => max(1, (int) ($data['version'] ?? 1)),
            'metadata' => $data['metadata'] ?? null,
        ]);

        if ($tier === AppTier::Hosted) {
            $app = $this->hostingService->provisionHosted($app);
        }

        return $this->syncWebsiteLinkIcon($app, is_array($data['metadata'] ?? null) ? $data['metadata'] : []);
    }

    private function visibleParentAppId(int $userId, mixed $parentAppId): ?int
    {
        $id = (int) ($parentAppId ?? 0);
        if ($id <= 0) {
            return null;
        }

        return $this->findVisibleForUser($userId, $id) !== null ? $id : null;
    }

    /**
     * @param  array<string, mixed>|null  $metadata
     */
    private function syncWebsiteLinkIcon(GeneratedApp $app, ?array $metadata = null): GeneratedApp
    {
        if ($app->app_type !== 'website_link') {
            return $app;
        }

        $metadata = $metadata ?? (is_array($app->metadata) ? $app->metadata : []);
        $normalized = $this->websiteLinkIconStorage->persistForApp($app, $metadata);

        if ($normalized == $metadata) {
            return $app->fresh(['user']) ?? $app;
        }

        return $this->appRepository->update($app, ['metadata' => $normalized]);
    }

    /**
     * 최근 생성 앱 목록을 조회합니다.
     *
     * @return array<int, array<string, mixed>>
     */
    public function listForUser(int $userId, int $limit = 20): array
    {
        return $this->appRepository->getForUser($userId, $limit)
            ->map(fn (GeneratedApp $app): array => $this->serializeForLibraryList($app, $userId))
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listPublished(int $limit = 50, ?int $viewerUserId = null): array
    {
        return $this->appRepository->getPublished($limit)
            ->map(fn (GeneratedApp $app): array => $this->serializeForLibraryList($app, $viewerUserId))
            ->all();
    }

    /** @deprecated use listPublished() */
    public function listShared(int $limit = 50, ?int $viewerUserId = null): array
    {
        return $this->listPublished($limit, $viewerUserId);
    }

    /**
     * 홈 셸 라이브러리 1회 조회용 — owned·published 목록을 함께 반환합니다.
     *
     * @return array{owned: array<int, array<string, mixed>>, shared: array<int, array<string, mixed>>}
     */
    public function libraryForUser(int $userId, int $ownedLimit = 20, int $sharedLimit = 50): array
    {
        return [
            'owned' => $this->listForUser($userId, $ownedLimit),
            'shared' => $this->listPublished($sharedLimit, $userId),
        ];
    }

    public function findForUser(int $userId, int $id): ?GeneratedApp
    {
        return $this->appRepository->findForUser($userId, $id);
    }

    public function findVisibleForUser(int $userId, int $id): ?GeneratedApp
    {
        return $this->appRepository->findVisibleForUser($userId, $id);
    }

    public function findPublished(int $id): ?GeneratedApp
    {
        return $this->appRepository->findPublished($id);
    }

    /** @deprecated use findPublished() */
    public function findShared(int $id): ?GeneratedApp
    {
        return $this->findPublished($id);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function updateForUser(int $userId, int $id, array $data): ?GeneratedApp
    {
        $app = $this->findForUser($userId, $id);
        if ($app === null) {
            return null;
        }
        $parentAppId = array_key_exists('parent_app_id', $data)
            ? $this->visibleParentAppId($userId, $data['parent_app_id'])
            : $app->parent_app_id;

        $updated = $this->appRepository->update($app, [
            'title' => $data['title'],
            'app_type' => $data['app_type'],
            'tier' => array_key_exists('tier', $data)
                ? (AppTier::tryFrom((string) $data['tier']) ?? AppTier::Standard)->value
                : $app->tier,
            'model_id' => $data['model_id'] ?? null,
            'prompt' => $data['prompt'] ?? null,
            'html' => $this->htmlService->harden((string) $data['html']),
            'visibility' => array_key_exists('visibility', $data)
                ? $this->resolveVisibility($data['visibility'])
                : (array_key_exists('is_shared', $data)
                    ? $this->resolveVisibility($data['is_shared'])
                    : GeneratedAppPublishPolicy::visibilityOf($app)->value),
            'parent_app_id' => $parentAppId,
            'version' => max(1, (int) ($data['version'] ?? $app->version ?? 1)),
            'metadata' => $data['metadata'] ?? $app->metadata,
        ]);

        if (
            AppTier::tryFrom((string) ($updated->tier ?? AppTier::Standard->value)) === AppTier::Hosted
            && $updated->hosted_subdomain === null
        ) {
            $updated = $this->hostingService->provisionHosted($updated);
        }

        return $this->syncWebsiteLinkIcon(
            $updated,
            array_key_exists('metadata', $data) && is_array($data['metadata']) ? $data['metadata'] : null,
        );
    }

    public function setVisibilityForUser(int $userId, int $id, GeneratedAppVisibility $visibility): ?GeneratedApp
    {
        $app = $this->findForUser($userId, $id);
        if ($app === null) {
            return null;
        }

        return $this->appRepository->update($app, [
            'visibility' => $visibility->value,
        ]);
    }

    /** @deprecated use setVisibilityForUser() */
    public function setSharedForUser(int $userId, int $id, bool $isShared): ?GeneratedApp
    {
        return $this->setVisibilityForUser(
            $userId,
            $id,
            $isShared ? GeneratedAppVisibility::Tenant : GeneratedAppVisibility::Private,
        );
    }

    public function deleteForUser(int $userId, int $id): bool
    {
        $app = $this->findForUser($userId, $id);
        if ($app === null) {
            return false;
        }

        $this->purgeService->purgeDatastore($app);

        return true;
    }

    /**
     * 라이브러리·목록 API용 직렬화. preview_url(토큰·URL 생성) 생략.
     *
     * @return array<string, mixed>
     */
    public function serializeForLibraryList(GeneratedApp $app, ?int $viewerUserId = null): array
    {
        $payload = $this->serialize($app, includeHtml: false, viewerUserId: $viewerUserId);
        unset($payload['preview_url']);

        return $payload;
    }

    /**
     * @return array<string, mixed>
     */
    public function serialize(GeneratedApp $app, bool $includeHtml = true, ?int $viewerUserId = null): array
    {
        $ownerName = trim($this->ownerResolver->nickname($app));
        if ($ownerName === '') {
            $ownerName = __('moabom-apps::messages.apps.generated.owner_unknown');
        }

        $isOwner = $viewerUserId !== null && (int) $app->user_id === $viewerUserId;
        $visibility = GeneratedAppPublishPolicy::visibilityOf($app);
        $canRemix = $viewerUserId !== null
            && ! $isOwner
            && $visibility->isPublished()
            && GeneratedAppPublishPolicy::viewerCanSeePublished($app);
        $payload = [
            'id' => $app->id,
            'title' => $app->title,
            'app_type' => $app->app_type,
            'tier' => $app->tier ?? AppTier::Standard->value,
            'hosted_subdomain' => $app->hosted_subdomain,
            'preview_url' => $this->previewService->buildPreviewUrl($app, $viewerUserId),
            'model_id' => $app->model_id,
            'prompt' => $app->prompt,
            'visibility' => $visibility->value,
            'is_shared' => $visibility->isPublished(),
            'parent_app_id' => $app->parent_app_id,
            'version' => $app->version ?? 1,
            'metadata' => $this->websiteLinkIconStorage->normalizeMetadataForResponse(
                $app,
                is_array($app->metadata) ? $app->metadata : [],
            ),
            'owner' => [
                'id' => $app->user_id,
                'nickname' => $ownerName,
            ],
            'permissions' => [
                'is_owner' => $isOwner,
                'can_edit' => $isOwner || $canRemix,
                'can_share' => $isOwner,
                'can_delete' => $isOwner,
                'edit_mode' => $isOwner ? 'owner' : ($canRemix ? 'remix' : 'none'),
            ],
            'created_at' => $app->created_at?->toISOString(),
        ];

        if ($includeHtml) {
            $payload['html'] = $app->html;
        }

        return $payload;
    }

    /**
     * OpenAI Chat Completions API를 통해 HTML을 생성합니다.
     *
     * @param  array{prompt: string, app_type: string, model_id: string}  $data
     * @return array<string, mixed>
     *
     * @throws ConnectionException
     */
    private function generateWithAnthropic(array $data, string $model): array
    {
        $apiKey = (string) config('moabom-apps.ai.anthropic_api_key', '');
        if ($apiKey === '') {
            return $this->fallbackHtml($data, __('moabom-apps::messages.apps.ai.notice.anthropic_no_key'));
        }

        $response = Http::withHeaders([
            'x-api-key' => $apiKey,
            'anthropic-version' => '2023-06-01',
        ])
            ->acceptJson()
            ->timeout((int) config('moabom-apps.ai.timeout', 45))
            ->post('https://api.anthropic.com/v1/messages', [
                'model' => $model,
                'system' => $this->systemPrompt($data['app_type']),
                'messages' => [
                    ['role' => 'user', 'content' => $this->buildPrompt($data)],
                ],
                'temperature' => 0.7,
                'max_tokens' => $this->maxOutputTokens(),
            ]);

        if (! $response->successful()) {
            $this->logUpstreamFailure('anthropic', $model, $response->status(), $response->body());

            return $this->fallbackHtml($data, __('moabom-apps::messages.apps.ai.notice.anthropic_failed'));
        }

        $content = collect(data_get($response->json(), 'content', []))
            ->where('type', 'text')
            ->pluck('text')
            ->implode('');

        return $this->htmlResult($data, $content, 'anthropic', $model);
    }

    private function generateWithOpenAi(array $data, string $model): array
    {
        $apiKey = (string) config('moabom-apps.ai.openai_api_key', '');
        if ($apiKey === '') {
            return $this->fallbackHtml($data, __('moabom-apps::messages.apps.ai.notice.openai_no_key'));
        }

        $response = Http::withToken($apiKey)
            ->acceptJson()
            ->timeout((int) config('moabom-apps.ai.timeout', 45))
            ->post(
                'https://api.openai.com/v1/chat/completions',
                $this->buildOpenAiChatPayload($model, [
                    ['role' => 'system', 'content' => $this->systemPrompt($data['app_type'])],
                    ['role' => 'user', 'content' => $this->buildPrompt($data)],
                ])
            );

        if (! $response->successful()) {
            $this->logUpstreamFailure('openai', $model, $response->status(), $response->body());

            return $this->fallbackHtml($data, __('moabom-apps::messages.apps.ai.notice.openai_failed'));
        }

        $content = (string) data_get($response->json(), 'choices.0.message.content', '');

        return $this->htmlResult($data, $content, 'openai', $model);
    }

    private function generateWithGoogle(array $data, string $model): array
    {
        $apiKey = (string) config('moabom-apps.ai.google_api_key', '');
        if ($apiKey === '') {
            return $this->fallbackHtml($data, __('moabom-apps::messages.apps.ai.notice.google_no_key'));
        }

        $response = Http::acceptJson()
            ->timeout((int) config('moabom-apps.ai.timeout', 45))
            ->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}", [
                'systemInstruction' => [
                    'parts' => [
                        ['text' => $this->systemPrompt($data['app_type'])],
                    ],
                ],
                'contents' => [
                    [
                        'role' => 'user',
                        'parts' => [
                            ['text' => $this->buildPrompt($data)],
                        ],
                    ],
                ],
                'generationConfig' => [
                    'temperature' => 0.7,
                    'maxOutputTokens' => $this->maxOutputTokens(),
                ],
            ]);

        if (! $response->successful()) {
            $this->logUpstreamFailure('google', $model, $response->status(), $response->body());

            return $this->fallbackHtml($data, __('moabom-apps::messages.apps.ai.notice.google_failed'));
        }

        $content = collect(data_get($response->json(), 'candidates.0.content.parts', []))
            ->pluck('text')
            ->implode('');

        return $this->htmlResult($data, $content, 'google', $model);
    }

    /**
     * @param  array{prompt: string, app_type: string, model_id: string, current_html?: string|null}  $data
     * @return array<string, mixed>
     */
    private function htmlResult(array $data, string $content, string $provider, string $model): array
    {
        return [
            'html' => $this->extractHtml($content) ?: $this->fallbackHtml($data)['html'],
            'model_id' => $data['model_id'],
            'provider' => $provider,
            'upstream_model' => $model,
            'fallback' => false,
        ];
    }

    /**
     * @param  array{prompt: string, app_type: string, model_id: string, current_html?: string|null}  $data
     */
    private function buildPrompt(array $data): string
    {
        $currentHtml = trim((string) ($data['current_html'] ?? ''));
        if ($currentHtml !== '') {
            return sprintf(
                "다음 HTML 코드를 수정해주세요.\n\n수정 요청: %s\n\n기존 HTML 코드:\n```html\n%s\n```\n\n위 HTML 코드를 수정 요청에 맞게 수정하고, 전체 HTML 코드를 다시 출력해주세요.",
                $data['prompt'],
                $currentHtml
            );
        }

        return sprintf(
            "App type: %s\nUser request:\n%s",
            $data['app_type'],
            $data['prompt']
        );
    }

    private function generationMode(array $data, bool $continue, string $partialRaw): string
    {
        $mode = (string) ($data['generation_mode'] ?? '');
        if (in_array($mode, ['append', 'patch', 'generate'], true)) {
            return $mode;
        }
        if ($continue && $partialRaw !== '') {
            return 'append';
        }
        if (trim((string) ($data['current_html'] ?? '')) !== '') {
            return 'patch';
        }

        return 'generate';
    }

    private function tailContext(string $html, int $bytes = 6000): string
    {
        if (strlen($html) <= $bytes) {
            return $html;
        }

        return substr($html, -$bytes);
    }

    private function applyPatchResponse(string $currentHtml, string $patchText): string
    {
        $html = trim($currentHtml);
        if ($html === '') {
            return '';
        }

        if (! preg_match_all('/---SEARCH---\s*(.*?)\s*---REPLACE---\s*(.*?)(?=---SEARCH---|<<<END_PATCH>>>|\z)/s', $patchText, $matches, PREG_SET_ORDER)) {
            return $this->extractHtml($patchText);
        }

        $applied = 0;
        foreach ($matches as $match) {
            $search = (string) ($match[1] ?? '');
            $replace = (string) ($match[2] ?? '');
            $search = $this->normalizePatchSegment($search);
            $replace = $this->normalizePatchSegment($replace);
            if ($search === '' || substr_count($html, $search) !== 1) {
                continue;
            }
            $html = str_replace($search, $replace, $html);
            $applied++;
        }

        if ($applied === 0) {
            return '';
        }

        return $this->extractHtml($html) !== '' ? $html : '';
    }

    private function normalizePatchSegment(string $segment): string
    {
        $segment = preg_replace('/^\s*\R|\R\s*$/u', '', $segment) ?? $segment;

        return str_replace(["\r\n", "\r"], "\n", $segment);
    }

    private function systemPrompt(string $appType): string
    {
        return self::SYSTEM_PROMPTS[$appType] ?? self::SYSTEM_PROMPTS['general'];
    }

    /**
     * @return array{provider: string, model: string}
     */
    private function resolveModel(string $modelId): array
    {
        $models = config('moabom-apps.ai.models', []);
        $fallback = $models['claude-sonnet'] ?? ['provider' => 'anthropic', 'model' => 'claude-sonnet-4-20250514'];

        return $models[$modelId] ?? $fallback;
    }

    private function extractHtml(string $content): string
    {
        $trimmed = trim($content);
        if (preg_match('/```html\s*([\s\S]*?)\s*```/', $trimmed, $matches) === 1) {
            $trimmed = trim($matches[1]);
        }

        if (
            str_contains($trimmed, '<html')
            && str_contains($trimmed, '</html>')
            && str_contains($trimmed, '<body')
            && str_contains($trimmed, '</body>')
        ) {
            return $trimmed;
        }

        return '';
    }

    private function maxOutputTokens(): int
    {
        return max(1024, min(65536, (int) config('moabom-apps.ai.max_output_tokens', 30000)));
    }

    private function openAiTemperature(string $model): ?float
    {
        return str_starts_with($model, 'gpt-5') ? null : 0.7;
    }

    private function logUpstreamFailure(string $provider, string $model, int $status, string $body): void
    {
        Log::warning('moabom_apps_ai_upstream_failed', [
            'provider' => $provider,
            'model' => $model,
            'status' => $status,
            'body_excerpt' => mb_substr($body, 0, 600),
        ]);
    }

    /**
     * 설정이 없을 때도 앱 윈도우가 실제로 동작하도록 기본 HTML을 반환합니다.
     *
     * @param  array{prompt: string, app_type: string, model_id: string}  $data
     * @return array<string, mixed>
     */
    private function fallbackHtml(array $data, ?string $notice = null): array
    {
        $title = e(Str::limit($data['prompt'], 60, ''));
        $body = e($data['prompt']);
        $noticeText = e($notice ?? __('moabom-apps::messages.apps.ai.notice.default'));

        return [
            'html' => <<<HTML
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{$title}</title>
  <style>
    body { margin: 0; min-height: 100vh; font-family: system-ui, sans-serif; background: linear-gradient(135deg, #eef2ff, #fdf2f8); color: #1f2937; display: grid; place-items: center; }
    main { width: min(720px, calc(100vw - 32px)); padding: 32px; border-radius: 28px; background: rgba(255,255,255,.76); box-shadow: 0 20px 60px rgba(15,23,42,.16); }
    small { color: #7c3aed; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    h1 { margin: 12px 0; font-size: clamp(28px, 5vw, 48px); }
    p { line-height: 1.7; }
  </style>
</head>
<body>
  <main>
    <small>{$noticeText}</small>
    <h1>{$title}</h1>
    <p>{$body}</p>
  </main>
</body>
</html>
HTML,
            'model_id' => $data['model_id'],
            'provider' => 'fallback',
            'fallback' => true,
            'notice' => $notice,
        ];
    }

  /**
     * @param  bool|string|GeneratedAppVisibility|null  $value
     */
    private function resolveVisibility(mixed $value): string
    {
        if ($value instanceof GeneratedAppVisibility) {
            return $value->value;
        }

        if (is_string($value)) {
            $parsed = GeneratedAppVisibility::tryFrom(trim($value));
            if ($parsed !== null) {
                return $parsed->value;
            }
        }

        if ($value === true) {
            return GeneratedAppVisibility::Tenant->value;
        }

        return GeneratedAppVisibility::Private->value;
    }
}
