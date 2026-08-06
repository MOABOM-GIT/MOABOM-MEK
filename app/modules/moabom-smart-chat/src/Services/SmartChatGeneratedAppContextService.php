<?php

namespace Modules\Moabom\Smart\Chat\Services;

use App\Models\User;
use Modules\Moabom\Apps\Services\AiAppService;
use Throwable;

/**
 * 내 생성앱 Q&A 컨텍스트 — title/prompt/HTML 요약만 주입 (전체 HTML 맹목 삽입 금지).
 */
class SmartChatGeneratedAppContextService
{
    public function __construct(
        private readonly AiAppService $aiAppService,
    ) {}

    /**
     * @return list<array{id: int, title: string, app_type: string|null}>
     */
    public function listForPicker(User $user, int $limit = 40): array
    {
        $limit = max(1, min(100, $limit));
        try {
            $library = $this->aiAppService->libraryForUser($user->id, $limit, 0);
            $owned = is_array($library['owned'] ?? null) ? $library['owned'] : [];
            $out = [];
            foreach ($owned as $row) {
                if (! is_array($row) || ! isset($row['id'])) {
                    continue;
                }
                $out[] = [
                    'id' => (int) $row['id'],
                    'title' => (string) ($row['title'] ?? ''),
                    'app_type' => isset($row['app_type']) ? (string) $row['app_type'] : null,
                ];
            }

            return $out;
        } catch (Throwable) {
            return [];
        }
    }

    /**
     * @return array{ok: bool, text: string, app: array<string, mixed>|null}
     */
    public function buildContext(User $user, int $appId): array
    {
        if ($appId <= 0) {
            return ['ok' => false, 'text' => '', 'app' => null];
        }

        try {
            $app = $this->aiAppService->findVisibleForUser($user->id, $appId);
            if ($app === null) {
                return ['ok' => false, 'text' => '', 'app' => null];
            }

            $serialized = $this->aiAppService->serialize($app, true, $user->id);
            $title = (string) ($serialized['title'] ?? '');
            $prompt = trim((string) ($serialized['prompt'] ?? ''));
            $html = (string) ($serialized['html'] ?? '');
            $maxHtml = (int) config('moabom-smart-chat.tools.generated_app.max_html_chars', 12000);
            if (mb_strlen($html) > $maxHtml) {
                $html = mb_substr($html, 0, $maxHtml)."\n<!-- truncated -->";
            }

            $text = "[generated_app]\nid: {$app->id}\ntitle: {$title}\napp_type: "
                .(string) ($serialized['app_type'] ?? '')."\n";
            if ($prompt !== '') {
                $text .= "original_prompt:\n{$prompt}\n\n";
            }
            if ($html !== '') {
                $text .= "html:\n{$html}\n";
            }

            return [
                'ok' => true,
                'text' => $text,
                'app' => [
                    'id' => $app->id,
                    'title' => $title,
                    'app_type' => $serialized['app_type'] ?? null,
                ],
            ];
        } catch (Throwable) {
            return ['ok' => false, 'text' => '', 'app' => null];
        }
    }
}
