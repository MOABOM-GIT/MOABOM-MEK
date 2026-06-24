<?php

namespace Modules\Moabom\Cpap\Services;

use Modules\Moabom\Cpap\Contracts\CpapMeasurementRepositoryInterface;
use Modules\Moabom\Cpap\Models\CpapMeasurement;

class CpapMeasurementService
{
    public function __construct(
        private readonly CpapMeasurementRepositoryInterface $measurementRepository,
        private readonly CpapRecommendEngine $recommendEngine,
    ) {
    }

    /**
     * CPAP 마스크 피팅 측정 결과를 저장합니다.
     *
     * 보안(C5): 클라이언트가 전송한 `recommendation`(type/confidence/name 등)은 신뢰하지 않고,
     * 동일 알고리즘을 서버에서 재계산해 권위 있는 추천값을 저장한다.
     *
     * @param  array<string, mixed>  $data
     */
    public function store(int $userId, array $data): CpapMeasurement
    {
        $profile = is_array($data['profile'] ?? null) ? $data['profile'] : [];
        $measurements = is_array($data['measurements'] ?? null) ? $data['measurements'] : [];
        $profileMeasurements = is_array($data['profile_measurements'] ?? null)
            ? $data['profile_measurements']
            : [];

        $recommendation = $this->recommendEngine->recommend($profile, $measurements, $profileMeasurements);

        return $this->measurementRepository->create([
            'user_id' => $userId,
            'profile' => $profile,
            'measurements' => $measurements,
            'profile_measurements' => $data['profile_measurements'] ?? null,
            'recommendation' => $recommendation,
            'mask_type' => $recommendation['type'],
            'confidence' => $recommendation['confidence'],
            'metadata' => $data['metadata'] ?? null,
        ]);
    }

    /**
     * 최근 측정 결과를 조회합니다.
     */
    public function latestForUser(int $userId): ?CpapMeasurement
    {
        return $this->measurementRepository->latestForUser($userId);
    }

    /**
     * 측정 결과를 응답 배열로 변환합니다.
     *
     * @return array<string, mixed>
     */
    public function serialize(CpapMeasurement $measurement): array
    {
        return [
            'id' => $measurement->id,
            'profile' => $measurement->profile,
            'measurements' => $measurement->measurements,
            'profile_measurements' => $measurement->profile_measurements,
            'recommendation' => $measurement->recommendation,
            'mask_type' => $measurement->mask_type,
            'confidence' => $measurement->confidence,
            'metadata' => $measurement->metadata ?? [],
            'created_at' => $measurement->created_at?->toISOString(),
        ];
    }
}
