<?php

declare(strict_types=1);

namespace Modules\Moabom\Cpap\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Moabom\Cpap\Contracts\CpapMeasurementRepositoryInterface;
use Modules\Moabom\Cpap\Models\CpapMeasurement;

class CpapMeasurementAdminService
{
    public function __construct(
        private readonly CpapMeasurementRepositoryInterface $measurementRepository,
    ) {}

    /**
     * @param  array<string, mixed>  $filters
     */
    public function paginate(array $filters = []): LengthAwarePaginator
    {
        $perPage = max(1, min(100, (int) ($filters['per_page'] ?? 20)));
        $search = trim((string) ($filters['q'] ?? ''));

        return $this->measurementRepository->paginateForAdmin(
            $perPage,
            $search !== '' ? $search : null,
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function serializeListItem(CpapMeasurement $measurement): array
    {
        $user = $measurement->user;
        $recommendation = is_array($measurement->recommendation) ? $measurement->recommendation : [];

        return [
            'id' => $measurement->id,
            'user_id' => $measurement->user_id,
            'user_name' => $user?->name,
            'user_email' => $user?->email,
            'mask_type' => $measurement->mask_type,
            'recommendation_name' => $recommendation['name'] ?? null,
            'confidence' => $measurement->confidence,
            'created_at' => $measurement->created_at?->toIso8601String(),
            'updated_at' => $measurement->updated_at?->toIso8601String(),
        ];
    }
}
