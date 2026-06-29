<?php

namespace Modules\Moabom\Credit\Repositories;

use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Modules\Moabom\Credit\Contracts\CreditRepositoryInterface;
use Modules\Moabom\Credit\Models\CreditAttendance;
use Modules\Moabom\Credit\Models\CreditBalance;
use Modules\Moabom\Credit\Models\CreditTransaction;

class CreditRepository implements CreditRepositoryInterface
{
    /**
     * 사용자 잔액 레코드를 조회하거나 생성합니다.
     */
    public function getOrCreateBalance(User $user): CreditBalance
    {
        return CreditBalance::firstOrCreate(
            ['user_id' => $user->id],
            ['balance' => 0, 'ranking_points' => 0]
        );
    }

    /**
     * 크레딧 갱신을 위해 잔액 레코드를 잠금 조회하거나 생성합니다.
     */
    public function getOrCreateBalanceForUpdate(User $user): CreditBalance
    {
        $balance = CreditBalance::where('user_id', $user->id)->lockForUpdate()->first();
        if ($balance) {
            return $balance;
        }

        CreditBalance::create([
            'user_id' => $user->id,
            'balance' => 0,
            'ranking_points' => 0,
        ]);

        return CreditBalance::where('user_id', $user->id)->lockForUpdate()->firstOrFail();
    }

    /**
     * 잔액을 갱신합니다.
     */
    public function updateBalance(CreditBalance $balance, int $amount): bool
    {
        return $balance->forceFill(['balance' => $amount])->save();
    }

    public function incrementRankingPoints(CreditBalance $balance, int $amount): void
    {
        if ($amount <= 0) {
            return;
        }

        $balance->increment('ranking_points', $amount);
    }

    /**
     * 거래 원장을 생성합니다.
     *
     * @param  array<string, mixed>  $data
     */
    public function createTransaction(array $data): CreditTransaction
    {
        return CreditTransaction::create($data);
    }

    /**
     * 최근 거래 내역을 조회합니다.
     *
     * @return Collection<int, CreditTransaction>
     */
    public function getRecentTransactions(User $user, int $limit = 10, int $offset = 0): Collection
    {
        return CreditTransaction::where('user_id', $user->id)
            ->latest()
            ->offset(max(0, $offset))
            ->limit(max(1, $limit))
            ->get();
    }

    /**
     * 거래 원장 총 건수를 조회합니다.
     */
    public function getTransactionCount(User $user): int
    {
        return (int) CreditTransaction::where('user_id', $user->id)->count();
    }

    /**
     * 사용자 크레딧 요약 정보를 조회합니다.
     *
     * @return array<string, int>
     */
    public function getSummary(User $user): array
    {
        $earned = (int) CreditTransaction::where('user_id', $user->id)
            ->where('amount', '>', 0)
            ->sum('amount');
        $used = (int) abs(CreditTransaction::where('user_id', $user->id)
            ->where('amount', '<', 0)
            ->sum('amount'));

        return [
            'total_earned' => $earned,
            'total_used' => $used,
        ];
    }

    /**
     * {@inheritDoc}
     */
    public function paginateUserBalances(
        ?string $search,
        int $page,
        int $perPage,
        string $sortBy,
        string $sortDirection
    ): LengthAwarePaginator {
        $direction = strtolower($sortDirection) === 'asc' ? 'asc' : 'desc';
        $safePerPage = max(1, min(100, $perPage));
        $safePage = max(1, $page);
        $keyword = trim((string) $search);
        $balancesTable = DB::getTablePrefix().'moabom_credit_balances';

        $query = User::query()
            ->select([
                'users.id',
                'users.uuid',
                'users.name',
                'users.email',
                'users.nickname',
                DB::raw("COALESCE({$balancesTable}.balance, 0) as balance"),
                DB::raw("COALESCE({$balancesTable}.ranking_points, 0) as ranking_points"),
                'moabom_credit_balances.updated_at as balance_updated_at',
            ])
            ->leftJoin('moabom_credit_balances', 'users.id', '=', 'moabom_credit_balances.user_id');

        if ($keyword !== '') {
            $like = '%'.addcslashes($keyword, '%_\\').'%';
            $query->where(function ($builder) use ($like): void {
                $builder->where('users.name', 'like', $like)
                    ->orWhere('users.email', 'like', $like)
                    ->orWhere('users.nickname', 'like', $like);
            });
        }

        $sortColumn = match ($sortBy) {
            'email' => 'users.email',
            'balance' => 'balance',
            'ranking_points' => 'ranking_points',
            default => 'users.name',
        };

        return $query
            ->orderBy($sortColumn, $direction)
            ->paginate($safePerPage, ['*'], 'page', $safePage);
    }

    /**
     * {@inheritDoc}
     */
    public function deleteAllDataForUser(User $user): array
    {
        return DB::transaction(function () use ($user): array {
            $userId = $user->id;

            return [
                'transactions' => CreditTransaction::query()->where('user_id', $userId)->delete(),
                'attendances' => CreditAttendance::query()->where('user_id', $userId)->delete(),
                'balances' => CreditBalance::query()->where('user_id', $userId)->delete(),
            ];
        });
    }
}
