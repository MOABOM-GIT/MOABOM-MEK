<?php

declare(strict_types=1);

namespace Modules\Moabom\Credit\Services;

use App\Helpers\PermissionHelper;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use InvalidArgumentException;
use Modules\Moabom\Credit\Contracts\CreditRepositoryInterface;
use Modules\Moabom\Credit\Enums\CreditTransactionType;
use Modules\Moabom\Credit\Models\CreditTransaction;
use Modules\Moabom\System\Support\MoabomPublicApiCacheKeys;

/**
 * 관리자 크레딧 운영 — 유저 잔액 목록·수동 조정.
 */
final class CreditAdminService
{
    public function __construct(
        private readonly CreditRepositoryInterface $creditRepository,
        private readonly CreditService $creditService,
    ) {}

    /**
     * @return array{
     *   items: list<array<string, mixed>>,
     *   pagination: array<string, int>,
     *   abilities: array{can_adjust: bool, can_delete: bool}
     * }
     */
    public function listUserCredits(
        ?string $search,
        int $page,
        int $perPage,
        string $sortBy,
        string $sortDirection,
        User $actor,
    ): array {
        $paginator = $this->creditRepository->paginateUserBalances(
            $search,
            $page,
            $perPage,
            $sortBy,
            $sortDirection,
        );

        return [
            'items' => collect($paginator->items())
                ->map(fn (User $user) => $this->formatUserCreditRow($user))
                ->values()
                ->all(),
            'pagination' => $this->formatPagination($paginator),
            'abilities' => [
                'can_adjust' => PermissionHelper::check('moabom-credit.balances.adjust', $actor),
                'can_delete' => PermissionHelper::check('moabom-credit.balances.delete', $actor)
                    || PermissionHelper::check('moabom-credit.balances.adjust', $actor),
            ],
        ];
    }

    /**
     * 관리자가 유저의 크레딧 데이터를 완전 삭제합니다.
     *
     * @return array{transactions: int, attendances: int, balances: int}
     */
    public function purgeUserCreditData(User $target): array
    {
        $deleted = $this->creditRepository->deleteAllDataForUser($target);
        MoabomPublicApiCacheKeys::forgetShellRankings();

        return $deleted;
    }

    /**
     * 관리자가 유저 크레딧을 증감합니다.
     */
    public function adjustUserCredit(
        User $target,
        int $amount,
        string $direction,
        ?string $description,
        User $actor,
    ): CreditTransaction {
        if ($amount <= 0) {
            throw new InvalidArgumentException(__('moabom-credit::messages.invalid_amount'));
        }

        if (! in_array($direction, ['increase', 'decrease'], true)) {
            throw new InvalidArgumentException(__('moabom-credit::messages.admin.invalid_direction'));
        }

        $signedAmount = $direction === 'decrease' ? -$amount : $amount;
        $note = trim((string) $description);
        if ($note === '') {
            $note = $direction === 'decrease'
                ? __('moabom-credit::messages.admin.decrease_default_description')
                : __('moabom-credit::messages.admin.increase_default_description');
        }

        return $this->creditService->recordTransaction(
            $target,
            CreditTransactionType::Adjust,
            $signedAmount,
            $note,
            'admin_adjust',
            (string) $actor->id,
            [
                'direction' => $direction,
                'admin_user_id' => $actor->id,
            ],
            skipDailyEarnLimit: true,
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function formatUserCreditRow(User $user): array
    {
        return [
            'user_id' => $user->id,
            'uuid' => $user->uuid,
            'name' => $user->name,
            'email' => $user->email,
            'nickname' => $user->nickname,
            'balance' => (int) ($user->balance ?? 0),
            'ranking_points' => (int) ($user->ranking_points ?? 0),
            'balance_updated_at' => $user->balance_updated_at,
        ];
    }

    /**
     * @return array<string, int>
     */
    private function formatPagination(LengthAwarePaginator $paginator): array
    {
        return [
            'current_page' => $paginator->currentPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'last_page' => $paginator->lastPage(),
        ];
    }
}
