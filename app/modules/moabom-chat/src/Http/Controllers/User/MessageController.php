<?php

namespace Modules\Moabom\Chat\Http\Controllers\User;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AuthBaseController;
use Illuminate\Http\JsonResponse;
use Modules\Moabom\Chat\Http\Requests\User\StoreMessageRequest;
use Modules\Moabom\Chat\Services\ChatService;

final class MessageController extends AuthBaseController
{
    public function __construct(
        private ChatService $chat,
    ) {
        parent::__construct();
    }

    public function index(string $conversationUuid): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $this->logApiUsage('moabom-chat.user.messages.index');

        try {
            return ResponseHelper::moduleSuccess(
                'moabom-chat',
                'messages.messages_success',
                $this->chat->listMessages(
                    $user,
                    $conversationUuid,
                    request()->query('before_id') ? (int) request()->query('before_id') : null,
                    (int) request()->query('limit', 30),
                ),
            );
        } catch (\InvalidArgumentException $e) {
            return $this->domainError($e);
        }
    }

    public function store(StoreMessageRequest $request, string $conversationUuid): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $this->logApiUsage('moabom-chat.user.messages.store');

        try {
            return ResponseHelper::moduleSuccess(
                'moabom-chat',
                'messages.message_sent',
                $this->chat->sendMessage(
                    $user,
                    $conversationUuid,
                    $request->validated('body'),
                    $request->validated('client_message_id'),
                ),
                201,
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
