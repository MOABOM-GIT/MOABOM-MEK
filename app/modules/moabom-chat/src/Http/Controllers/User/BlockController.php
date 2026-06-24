<?php

namespace Modules\Moabom\Chat\Http\Controllers\User;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AuthBaseController;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Modules\Moabom\Chat\Http\Requests\User\StoreBlockRequest;
use Modules\Moabom\Chat\Services\ChatService;

final class BlockController extends AuthBaseController
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

        $this->logApiUsage('moabom-chat.user.blocks.index');

        return ResponseHelper::moduleSuccess(
            'moabom-chat',
            'messages.blocks_success',
            $this->chat->listBlocks($user),
        );
    }

    public function store(StoreBlockRequest $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $this->logApiUsage('moabom-chat.user.blocks.store');

        try {
            $target = User::query()->where('uuid', $request->validated('user_uuid'))->firstOrFail();

            return ResponseHelper::moduleSuccess(
                'moabom-chat',
                'messages.block_saved',
                $this->chat->blockUser($user, $target, $request->validated('reason')),
            );
        } catch (ModelNotFoundException) {
            return ResponseHelper::moduleError('moabom-chat', 'messages.user_not_found', 404);
        } catch (\InvalidArgumentException $e) {
            return ResponseHelper::moduleError(
                'moabom-chat',
                'messages.'.$e->getMessage(),
                422,
                ['reason' => $e->getMessage()],
            );
        }
    }

    public function destroy(string $userUuid): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $this->logApiUsage('moabom-chat.user.blocks.destroy');

        try {
            $target = User::query()->where('uuid', $userUuid)->firstOrFail();

            return ResponseHelper::moduleSuccess(
                'moabom-chat',
                'messages.block_removed',
                $this->chat->unblockUser($user, $target),
            );
        } catch (ModelNotFoundException) {
            return ResponseHelper::moduleError('moabom-chat', 'messages.user_not_found', 404);
        }
    }
}
