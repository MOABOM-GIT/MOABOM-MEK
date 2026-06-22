<?php

namespace Modules\Moabom\Cpap\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
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

    /**
     * 관리자 목록용 페이지네이션 조회입니다.
     */
    public function paginateForAdmin(int $perPage, ?string $search = null): LengthAwarePaginator
    {
        $query = CpapMeasurement::query()
            ->with(['user:id,name,email'])
            ->latest('created_at');

        if ($search !== null && $search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($builder) use ($like): void {
                $builder
                    ->where('mask_type', 'like', $like)
                    ->orWhereHas('user', function ($userQuery) use ($like): void {
                        $userQuery
                            ->where('name', 'like', $like)
                            ->orWhere('email', 'like', $like);
                    });
            });
        }

        return $query->paginate($perPage);
    }
}
