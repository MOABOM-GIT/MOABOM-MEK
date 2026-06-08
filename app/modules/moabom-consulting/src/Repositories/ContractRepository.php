<?php

namespace Modules\Moabom\Consulting\Repositories;

use Illuminate\Database\Eloquent\Collection;
use Modules\Moabom\Consulting\Contracts\ContractRepositoryInterface;
use Modules\Moabom\Consulting\Models\Contract;

class ContractRepository implements ContractRepositoryInterface
{
    /**
     * 전자계약을 생성합니다.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): Contract
    {
        return Contract::query()->create($data);
    }

    /**
     * 상담원 본인의 계약 목록을 최신순으로 조회합니다.
     *
     * @return Collection<int, Contract>
     */
    public function getForUser(int $userId): Collection
    {
        return Contract::query()
            ->where('user_id', $userId)
            ->latest()
            ->get();
    }

    /**
     * 상담원 본인의 계약 1건을 조회합니다.
     */
    public function findForUser(int $userId, int $id): ?Contract
    {
        return Contract::query()
            ->where('user_id', $userId)
            ->whereKey($id)
            ->first();
    }
}
