<?php

declare(strict_types=1);

namespace Modules\Moabom\Credit\Http\Controllers\Admin;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AdminBaseController;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use InvalidArgumentException;
use Modules\Moabom\Credit\Http\Requests\Admin\AdjustUserCreditRequest;
use Modules\Moabom\Credit\Http\Requests\Admin\ListUserCreditsRequest;
use Modules\Moabom\Credit\Contracts\CreditRepositoryInterface;
use Modules\Moabom\Credit\Services\CreditAdminService;

class CreditUserAdminController extends AdminBaseController
{
    public function __construct(
        private readonly CreditAdminService $adminService,
        private readonly CreditRepositoryInterface $creditRepository,
    ) {}

    /**
     * 유저 크레딧 잔액 목록을 조회합니다.
     */
    public function index(ListUserCreditsRequest $request): JsonResponse
    {
        $validated = $request->validated();

        return ResponseHelper::moduleSuccess(
            'moabom-credit',
            'messages.admin.user_credits_list_success',
            $this->adminService->listUserCredits(
                $validated['search'] ?? null,
                (int) ($validated['page'] ?? 1),
                (int) ($validated['per_page'] ?? 20),
                (string) ($validated['sort'] ?? 'name'),
                (string) ($validated['direction'] ?? 'asc'),
                $request->user(),
            ),
        );
    }

    /**
     * 유저 크레딧을 수동 증감합니다.
     */
    public function adjust(AdjustUserCreditRequest $request, User $user): JsonResponse
    {
        try {
            $transaction = $this->adminService->adjustUserCredit(
                $user,
                (int) $request->validated('amount'),
                (string) $request->validated('direction'),
                $request->validated('description'),
                $request->user(),
            );
        } catch (InvalidArgumentException $e) {
            return ResponseHelper::moduleError(
                'moabom-credit',
                'messages.admin.adjust_failed',
                422,
                $e->getMessage(),
            );
        }

        $balance = $this->creditRepository->getOrCreateBalance($user);

        return ResponseHelper::moduleSuccess(
            'moabom-credit',
            'messages.admin.adjust_success',
            [
                'transaction' => [
                    'id' => $transaction->id,
                    'type' => $transaction->type?->value,
                    'amount' => $transaction->amount,
                    'balance_after' => $transaction->balance_after,
                    'description' => $transaction->description,
                    'created_at' => $transaction->created_at?->toISOString(),
                ],
                'user' => [
                    'user_id' => $user->id,
                    'uuid' => $user->uuid,
                    'name' => $user->name,
                    'email' => $user->email,
                    'nickname' => $user->nickname,
                    'balance' => $balance->balance,
                    'ranking_points' => $balance->ranking_points,
                ],
            ],
        );
    }

    /**
     * 유저 크레딧 데이터(잔액·원장·출석)를 완전 삭제합니다.
     */
    public function destroy(User $user): JsonResponse
    {
        $deleted = $this->adminService->purgeUserCreditData($user);

        return ResponseHelper::moduleSuccess(
            'moabom-credit',
            'messages.admin.delete_success',
            [
                'user' => [
                    'user_id' => $user->id,
                    'uuid' => $user->uuid,
                ],
                'deleted' => $deleted,
            ],
        );
    }
}
