<?php

namespace Modules\Moabom\Chat\Http\Controllers\User;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AuthBaseController;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Modules\Moabom\Chat\Http\Requests\User\MarkConversationReadRequest;
use Modules\Moabom\Chat\Http\Requests\User\StartConversationRequest;
use Modules\Moabom\Chat\Services\ChatService;

final class ConversationController extends AuthBaseController
{
    public function __construct(
        private ChatService $chat,
    ) {
        parent::__construct();
    }

    public function index(): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $this->logApiUsage('moabom-chat.user.conversations.index');

        return ResponseHelper::moduleSuccess(
            'moabom-chat',
            'messages.conversations_success',
            $this->chat->listConversations(
                $user,
                request()->query('search') ? (string) request()->query('search') : null,
                (int) request()->query('limit', 30),
            ),
        );
    }

    public function store(StartConversationRequest $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $this->logApiUsage('moabom-chat.user.conversations.store');

        $memberUuids = $request->validated('member_uuids');
        $members = User::query()->whereIn('uuid', $memberUuids)->get();
        if ($members->count() !== count($memberUuids)) {
            return ResponseHelper::moduleError(
                'moabom-chat',
                'messages.user_not_found',
                404,
                ['reason' => 'user_not_found'],
            );
        }

        try {
            return ResponseHelper::moduleSuccess(
                'moabom-chat',
                'messages.conversation_ready',
                $this->chat->startConversation($user, $members->all(), $request->validated('title')),
            );
        } catch (\InvalidArgumentException $e) {
            return $this->domainError($e);
        }
    }

    public function read(MarkConversationReadRequest $request, string $conversationUuid): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $this->logApiUsage('moabom-chat.user.conversations.read');

        try {
            return ResponseHelper::moduleSuccess(
                'moabom-chat',
                'messages.conversation_read',
                $this->chat->markRead($user, $conversationUuid, $request->validated('message_id')),
            );
        } catch (\InvalidArgumentException $e) {
            return $this->domainError($e);
        }
    }

    public function focus(string $conversationUuid): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $this->logApiUsage('moabom-chat.user.conversations.focus');

        try {
            $this->chat->focusConversation($user, $conversationUuid);

            return ResponseHelper::moduleSuccess('moabom-chat', 'messages.conversation_focused', []);
        } catch (\InvalidArgumentException $e) {
            return $this->domainError($e);
        }
    }

    public function unfocus(string $conversationUuid): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $this->logApiUsage('moabom-chat.user.conversations.unfocus');

        try {
            $this->chat->clearConversationFocus($user, $conversationUuid);

            return ResponseHelper::moduleSuccess('moabom-chat', 'messages.conversation_unfocused', []);
        } catch (\InvalidArgumentException $e) {
            return $this->domainError($e);
        }
    }

    public function typing(string $conversationUuid): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $this->logApiUsage('moabom-chat.user.conversations.typing');

        try {
            return ResponseHelper::moduleSuccess(
                'moabom-chat',
                'messages.typing_signaled',
                $this->chat->signalTyping($user, $conversationUuid),
            );
        } catch (\InvalidArgumentException $e) {
            return $this->domainError($e);
        }
    }

    public function destroy(string $conversationUuid): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $this->logApiUsage('moabom-chat.user.conversations.destroy');

        try {
            return ResponseHelper::moduleSuccess(
                'moabom-chat',
                'messages.conversation_deleted',
                $this->chat->leaveConversation($user, $conversationUuid),
            );
        } catch (\InvalidArgumentException $e) {
            return $this->domainError($e);
        }
    }

    public function mute(string $conversationUuid): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $this->logApiUsage('moabom-chat.user.conversations.mute');

        try {
            $hours = request()->has('hours') ? (int) request()->input('hours') : null;

            return ResponseHelper::moduleSuccess(
                'moabom-chat',
                'messages.conversation_muted',
                $this->chat->muteConversation($user, $conversationUuid, $hours),
            );
        } catch (\InvalidArgumentException $e) {
            return $this->domainError($e);
        }
    }

    public function unmute(string $conversationUuid): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $this->logApiUsage('moabom-chat.user.conversations.unmute');

        try {
            return ResponseHelper::moduleSuccess(
                'moabom-chat',
                'messages.conversation_unmuted',
                $this->chat->muteConversation($user, $conversationUuid, 0),
            );
        } catch (\InvalidArgumentException $e) {
            return $this->domainError($e);
        }
    }

    private function domainError(\InvalidArgumentException $e): JsonResponse
    {
        $reason = $e->getMessage();
        $status = $reason === 'conversation_not_found' ? 404 : 422;

        return ResponseHelper::moduleError(
            'moabom-chat',
            'messages.'.$reason,
            $status,
            ['reason' => $reason],
        );
    }
}
