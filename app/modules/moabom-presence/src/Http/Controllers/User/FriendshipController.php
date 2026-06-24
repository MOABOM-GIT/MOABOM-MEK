<?php

namespace Modules\Moabom\Presence\Http\Controllers\User;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AuthBaseController;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Modules\Moabom\Presence\Http\Requests\User\FriendActionRequest;
use Modules\Moabom\Presence\Services\FriendshipService;

final class FriendshipController extends AuthBaseController
{
    public function __construct(
        private FriendshipService $friendshipService,
    ) {
        parent::__construct();
    }

    public function index(): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $this->logApiUsage('moabom-presence.user.friends.index');

        return ResponseHelper::moduleSuccess(
            'moabom-presence',
            'messages.friends_success',
            ['friends' => $this->friendshipService->listFriends($user)],
        );
    }

    public function store(FriendActionRequest $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $this->logApiUsage('moabom-presence.user.friends.store');

        try {
            $target = User::query()->where('uuid', $request->validated('user_uuid'))->firstOrFail();
            $friendship = $this->friendshipService->sendRequest($user, $target);

            return ResponseHelper::moduleSuccess(
                'moabom-presence',
                'messages.friend_request_sent',
                ['status' => $friendship->status->value],
            );
        } catch (ModelNotFoundException) {
            return ResponseHelper::moduleError(
                'moabom-presence',
                'messages.user_presence_not_found',
                404,
            );
        } catch (\InvalidArgumentException $e) {
            return ResponseHelper::moduleError(
                'moabom-presence',
                'messages.'.$e->getMessage(),
                422,
                ['reason' => $e->getMessage()],
            );
        }
    }

    public function accept(FriendActionRequest $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $this->logApiUsage('moabom-presence.user.friends.accept');

        try {
            $requester = User::query()->where('uuid', $request->validated('user_uuid'))->firstOrFail();
            $friendship = $this->friendshipService->acceptRequest($user, $requester);

            return ResponseHelper::moduleSuccess(
                'moabom-presence',
                'messages.friend_request_accepted',
                ['status' => $friendship->status->value],
            );
        } catch (ModelNotFoundException) {
            return ResponseHelper::moduleError(
                'moabom-presence',
                'messages.user_presence_not_found',
                404,
            );
        } catch (\InvalidArgumentException $e) {
            return ResponseHelper::moduleError(
                'moabom-presence',
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

        $this->logApiUsage('moabom-presence.user.friends.destroy');

        try {
            $other = User::query()->where('uuid', $userUuid)->firstOrFail();
            $deleted = $this->friendshipService->removeFriendship($user, $other);

            return ResponseHelper::moduleSuccess(
                'moabom-presence',
                'messages.friend_removed',
                ['deleted' => $deleted > 0],
            );
        } catch (ModelNotFoundException) {
            return ResponseHelper::moduleError(
                'moabom-presence',
                'messages.user_presence_not_found',
                404,
            );
        }
    }
}
