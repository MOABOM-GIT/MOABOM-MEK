<?php

namespace Modules\Moabom\Credit\Repositories;

use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Modules\Moabom\Credit\Contracts\CreditRepositoryInterface;
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
            ['balance' => 0]
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
}
