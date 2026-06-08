<?php

namespace Modules\Moabom\Apps\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Modules\Moabom\Apps\Contracts\GeneratedAppRepositoryInterface;
use Modules\Moabom\Apps\Models\GeneratedApp;

class AiAppService
{
    public function __construct(
        private readonly GeneratedAppRepositoryInterface $appRepository,
    ) {
    }

    /**
     * 저장/서빙되는 AI 생성 HTML 에 주입하는 CSP (C2 — deploy/PROJECT-ARCHITECTURE-HARDENING.md).
     *
     * 프론트(aiHtmlUtils.ts AI_PREVIEW_CSP)와 동일 정책. iframe 은 allow-same-origin 을
     * 제거해 opaque origin 으로 격리되며, 이 CSP 는 심층 방어(프론트 미경유 직접 API 저장도 보호).
     */
    private const PREVIEW_CSP =
        "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; "
        ."script-src 'unsafe-inline' 'unsafe-eval' https: blob:; "
        ."style-src 'unsafe-inline' https:; "
        ."img-src 'self' data: blob: https:; "
        ."font-src 'self' data: https:; "
        ."media-src 'self' data: blob: https:; "
        ."connect-src https:; "
        ."frame-ancestors 'none'; base-uri 'none'; form-action 'self' https:;";

    /**
     * 앱 타입별 시스템 프롬프트입니다.
     *
     * @var array<string, string>
     */
    private const SYSTEM_PROMPTS = [
        'general' => self::COMMON_STATIC_PROMPT."\n\nAPP TYPE: General Web Application\n- Focus on clean, responsive UI\n- Use modern CSS (Flexbox, Grid)\n- Ensure mobile compatibility\n- For long lists/content: add overflow-y: auto with max-height\n- Review layout order, closed tags, and JavaScript errors before output.",
        '3d' => self::COMMON_STATIC_PROMPT."\n\nAPP TYPE: 3D Scene with Three.js\n- Use Three.js CDN: https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js\n- Dispose geometries/materials/textures on cleanup\n- Keep scene objects and polygon counts modest\n- Use a safe animation loop and cancelAnimationFrame on error.",
        'game' => self::COMMON_STATIC_PROMPT."\n\nAPP TYPE: Game with Phaser 3\n- Use Phaser 3 CDN: https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.min.js\n- Limit entities and use delta time\n- Provide restart/error handling\n- Clean up timers, sprites, and input listeners.",
        'dataviz' => self::COMMON_STATIC_PROMPT."\n\nAPP TYPE: Data Visualization with Chart.js\n- Use Chart.js CDN: https://cdn.jsdelivr.net/npm/chart.js\n- Keep a single chart instance and destroy before recreating\n- Validate data and limit data points\n- Chart containers must have an explicit safe height.",
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

SELF-REVIEW BEFORE OUTPUT:
- Check valid DOM order, no overlapping tags, no unclosed style/script tags.
- Check responsive design and mobile layout.
- Check JavaScript functions are defined before use.
- Add try/catch around interactive JavaScript and show a user-friendly retry action on error.
- Prevent infinite loops and memory leaks.
PROMPT;

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
        return $this->appRepository->create([
            'user_id' => $userId,
            'title' => $data['title'],
            'app_type' => $data['app_type'],
            'model_id' => $data['model_id'] ?? null,
            'prompt' => $data['prompt'] ?? null,
            'html' => $this->hardenHtml((string) $data['html']),
            'metadata' => $data['metadata'] ?? null,
        ]);
    }

    /**
     * 저장/갱신 시 AI 생성 HTML 에 CSP 메타를 주입한다(C2 심층 방어, 멱등).
     *
     * 프론트 injectAiPreviewSafety 가 이미 주입한 경우 그대로 둔다. 프론트를 거치지 않은
     * 직접 API 호출도 서버에서 CSP 가 보장되도록 한다. 앱 본문(스크립트 포함)은 자기완결
     * 동작을 위해 변형하지 않는다 — 격리는 iframe opaque origin + CSP 로 달성한다.
     */
    private function hardenHtml(string $html): string
    {
        if ($html === '') {
            return $html;
        }
        if (str_contains($html, 'http-equiv="Content-Security-Policy"')) {
            return $html;
        }

        $meta = '<meta http-equiv="Content-Security-Policy" content="'.self::PREVIEW_CSP.'">';

        if (preg_match('/<head[^>]*>/i', $html, $matches) === 1) {
            return (string) preg_replace('/<head[^>]*>/i', $matches[0].$meta, $html, 1);
        }
        if (stripos($html, '<body') !== false) {
            return (string) preg_replace('/<body/i', '<head>'.$meta.'</head><body', $html, 1);
        }

        return $meta.$html;
    }

    /**
     * 최근 생성 앱 목록을 조회합니다.
     *
     * @return array<int, array<string, mixed>>
     */
    public function listForUser(int $userId, int $limit = 20): array
    {
        return $this->appRepository->getForUser($userId, $limit)
            ->map(fn (GeneratedApp $app): array => $this->serialize($app, includeHtml: false))
            ->all();
    }

    public function findForUser(int $userId, int $id): ?GeneratedApp
    {
        return $this->appRepository->findForUser($userId, $id);
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

        return $this->appRepository->update($app, [
            'title' => $data['title'],
            'app_type' => $data['app_type'],
            'model_id' => $data['model_id'] ?? null,
            'prompt' => $data['prompt'] ?? null,
            'html' => $this->hardenHtml((string) $data['html']),
            'metadata' => $data['metadata'] ?? $app->metadata,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function serialize(GeneratedApp $app, bool $includeHtml = true): array
    {
        $payload = [
            'id' => $app->id,
            'title' => $app->title,
            'app_type' => $app->app_type,
            'model_id' => $app->model_id,
            'prompt' => $app->prompt,
            'metadata' => $app->metadata ?? [],
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
                'max_tokens' => 8000,
            ]);

        if (! $response->successful()) {
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
            ->post('https://api.openai.com/v1/chat/completions', [
                'model' => $model,
                'messages' => [
                    ['role' => 'system', 'content' => $this->systemPrompt($data['app_type'])],
                    ['role' => 'user', 'content' => $this->buildPrompt($data)],
                ],
                'temperature' => 0.7,
                'max_tokens' => 8000,
            ]);

        if (! $response->successful()) {
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
                    'maxOutputTokens' => 8000,
                ],
            ]);

        if (! $response->successful()) {
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
}
