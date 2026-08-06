<?php

namespace Modules\Moabom\Smart\Chat\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;
use Modules\Moabom\Smart\Chat\Services\SmartChatShareService;

/**
 * 공개 공유 링크 — 일반 이용자가 브라우저에서 바로 읽을 수 있는 평문(txt) 응답.
 * JSON 문법 없이 대화 제목·공유일과 [User]/[Assistant] 본문을 그대로 보여준다.
 */
class SmartChatPublicShareController extends Controller
{
    public function __invoke(string $token, Request $request, SmartChatShareService $shares): Response
    {
        $conversation = $shares->findByToken($token);
        if ($conversation === null) {
            return $this->plainText((string) __('moabom-smart-chat::messages.share.not_found'), 404);
        }

        $limit = (int) $request->query('limit', 100);
        $payload = $shares->publicPayload($conversation, $limit);

        $title = trim((string) ($payload['conversation']['title'] ?? ''));
        if ($title === '') {
            $title = (string) __('moabom-smart-chat::messages.conversation.untitled');
        }

        $lines = [$title];
        $sharedAt = $conversation->share_enabled_at;
        if ($sharedAt !== null) {
            $lines[] = __('moabom-smart-chat::messages.share.shared_at_label').': '.$sharedAt->format('Y-m-d H:i');
        }
        $lines[] = '';

        foreach ($payload['messages'] as $message) {
            $role = ($message['role'] ?? '') === 'user' ? 'User' : 'Assistant';
            $lines[] = "[{$role}]";
            $lines[] = (string) ($message['content'] ?? '');
            $lines[] = '';
        }

        return $this->plainText(implode("\n", $lines), 200);
    }

    private function plainText(string $body, int $status): Response
    {
        return new Response($body, $status, [
            'Content-Type' => 'text/plain; charset=UTF-8',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
