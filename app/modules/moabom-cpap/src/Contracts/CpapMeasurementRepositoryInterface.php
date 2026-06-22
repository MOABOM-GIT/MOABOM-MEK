<?php

namespace Modules\Moabom\Cpap\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Moabom\Cpap\Models\CpapMeasurement;

interface CpapMeasurementRepositoryInterface
{
    /**
     * CPAP 측정 결과를 생성합니다.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): CpapMeasurement;

    /**
     * 사용자의 최근 측정 결과를 조회합니다.
     */
    public function latestForUser(int $userId): ?CpapMeasurement;

    /**
     * 관리자 목록용 페이지네이션 조회입니다.
     */
    public function paginateForAdmin(int $perPage, ?string $search = null): LengthAwarePaginator;
}
