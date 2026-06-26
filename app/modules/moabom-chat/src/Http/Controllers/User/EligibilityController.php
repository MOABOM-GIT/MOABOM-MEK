<?php

namespace Modules\Moabom\Chat\Http\Controllers\User;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AuthBaseController;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Modules\Moabom\Chat\Services\ChatService;

final class EligibilityController extends AuthBaseController
{
    public function __construct(
        private ChatService $chat,
    ) {
        parent::__construct();
    }

    public function show(string $userUuid): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $this->logApiUsage('moabom-chat.user.eligibility.show');

        try {
            $target = User::query()->where('uuid', $userUuid)->firstOrFail();

            return ResponseHelper::moduleSuccess(
                'moabom-chat',
                'messages.eligibility_success',
                $this->chat->eligibility($user, $target),
            );
        } catch (ModelNotFoundException) {
            return ResponseHelper::moduleError('moabom-chat', 'messages.user_not_found', 404);
        }
    }

    public function index(): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $this->logApiUsage('moabom-chat.user.users.index');

        $term = trim((string) request()->query('search', ''));
        if ($term === '') {
            return ResponseHelper::moduleSuccess('moabom-chat', 'messages.users_success', ['users' => []]);
        }

        $users = User::query()
            ->where('id', '!=', $user->id)
            ->where(function ($query) use ($term): void {
                $query->where('name', 'like', '%'.$term.'%')
                    ->orWhere('nickname', 'like', '%'.$term.'%');
            })
            ->limit(20)
            ->get()
            ->map(function (User $target) use ($user): array {
                $nickname = trim((string) $target->nickname);
                $realName = trim((string) $target->name);

                return [
                    'user_uuid' => $target->uuid,
                    'display_name' => $nickname !== '' ? $nickname : $realName,
                    'nickname' => $nickname !== '' ? $nickname : $realName,
                    'real_name' => $realName,
                    'avatar' => $target->getAvatarUrl(),
                    'eligibility' => $this->chat->eligibility($user, $target),
                ];
            })
            ->values()
            ->all();

        return ResponseHelper::moduleSuccess('moabom-chat', 'messages.users_success', ['users' => $users]);
    }
}
