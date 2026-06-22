<?php

namespace Modules\Moabom\Credit\Contracts;

use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Modules\Moabom\Credit\Models\CreditBalance;
use Modules\Moabom\Credit\Models\CreditTransaction;

interface CreditRepositoryInterface
{
    /**
     * 사용자 잔액 레코드를 조회하거나 생성합니다.
     */
    public function getOrCreateBalance(User $user): CreditBalance;

    /**
     * 크레딧 갱신을 위해 잔액 레코드를 잠금 조회하거나 생성합니다.
     */
    public function getOrCreateBalanceForUpdate(User $user): CreditBalance;

    /**
     * 잔액을 갱신합니다.
     */
    public function updateBalance(CreditBalance $balance, int $amount): bool;

    /**
     * 거래 원장을 생성합니다.
     *
     * @param  array<string, mixed>  $data
     */
    public function createTransaction(array $data): CreditTransaction;

    /**
     * 최근 거래 내역을 조회합니다.
     *
     * @return Collection<int, CreditTransaction>
     */
    public function getRecentTransactions(User $user, int $limit = 10, int $offset = 0): Collection;

    /**
     * 거래 원장 총 건수를 조회합니다.
     */
    public function getTransactionCount(User $user): int;

    /**
     * 사용자 크레딧 요약 정보를 조회합니다.
     *
     * @return array<string, int>
     */
    public function getSummary(User $user): array;
}
