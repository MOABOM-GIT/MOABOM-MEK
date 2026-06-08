<?php

namespace Modules\Moabom\Consulting\Contracts;

use Illuminate\Database\Eloquent\Collection;
use Modules\Moabom\Consulting\Models\Contract;

interface ContractRepositoryInterface
{
    /**
     * 전자계약을 생성합니다.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): Contract;

    /**
     * 상담원 본인의 계약 목록을 최신순으로 조회합니다.
     *
     * @return Collection<int, Contract>
     */
    public function getForUser(int $userId): Collection;

    /**
     * 상담원 본인의 계약 1건을 조회합니다.
     */
    public function findForUser(int $userId, int $id): ?Contract;
}
