<?php

namespace Modules\Moabom\Cpap\Repositories;

use Modules\Moabom\Cpap\Contracts\CpapMeasurementRepositoryInterface;
use Modules\Moabom\Cpap\Models\CpapMeasurement;

class CpapMeasurementRepository implements CpapMeasurementRepositoryInterface
{
    /**
     * CPAP 측정 결과를 생성합니다.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): CpapMeasurement
    {
        return CpapMeasurement::query()->create($data);
    }

    /**
     * 사용자의 최근 측정 결과를 조회합니다.
     */
    public function latestForUser(int $userId): ?CpapMeasurement
    {
        return CpapMeasurement::query()
            ->where('user_id', $userId)
            ->latest()
            ->first();
    }
}
