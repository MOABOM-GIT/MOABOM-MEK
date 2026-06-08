<?php

namespace Modules\Moabom\Cpap\Services;

use Modules\Moabom\Cpap\Contracts\CpapMeasurementRepositoryInterface;
use Modules\Moabom\Cpap\Enums\MaskType;
use Modules\Moabom\Cpap\Models\CpapMeasurement;

class CpapMeasurementService
{
    public function __construct(
        private readonly CpapMeasurementRepositoryInterface $measurementRepository,
    ) {
    }

    /**
     * CPAP 마스크 피팅 측정 결과를 저장합니다.
     *
     * 보안(C5): 클라이언트가 전송한 `recommendation`(type/confidence/name 등)은 신뢰하지 않고,
     * 동일 알고리즘을 서버에서 재계산해 권위 있는 추천값을 저장한다. 프론트 `recommendMask`
     * (templates/moabom-basic/src/apps/cpap-mask/cpapMeasurement.ts)와 1:1 동작하므로
     * 정상 클라이언트의 경우 화면 표시값과 저장값이 일치한다(무손상).
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

        $recommendation = $this->recommend($profile, $measurements, $profileMeasurements);

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

    /**
     * 프로필 + 측정값으로 추천 마스크를 서버에서 재계산한다(프론트 recommendMask 포팅).
     *
     * @param  array<string, mixed>  $profile
     * @param  array<string, mixed>  $measurements
     * @param  array<string, mixed>  $profileMeasurements
     * @return array{type: string, name: string, confidence: int, reasons: list<string>, tips: list<string>}
     */
    private function recommend(array $profile, array $measurements, array $profileMeasurements): array
    {
        $noseWidth = $this->num($measurements, 'noseWidth');
        $faceLength = $this->num($measurements, 'faceLength');
        $faceWidth = $this->num($measurements, 'faceWidth');
        $mouthWidth = $this->num($measurements, 'mouthWidth');
        $philtrumLength = $this->num($measurements, 'philtrumLength');
        $bridgeWidth = $this->num($measurements, 'bridgeWidth');
        $noseHeight = $this->num($profileMeasurements, 'noseHeight');

        $sizeScore = $this->sizeBucket($noseWidth, 37, 43)
            + $this->sizeBucket($faceLength, 155, 165)
            + $this->sizeBucket($faceWidth, 145, 155)
            + $this->sizeBucket($mouthWidth, 43, 49);
        $size = $sizeScore <= 6 ? 'S' : ($sizeScore <= 10 ? 'M' : 'L');

        // 삽입 순서(nasal, pillow, full)는 동점 시 우선순위에 영향 → 보존.
        $scores = [
            'nasal' => ['score' => 50, 'reasons' => [], 'warnings' => []],
            'pillow' => ['score' => 50, 'reasons' => [], 'warnings' => []],
            'full' => ['score' => 50, 'reasons' => [], 'warnings' => []],
        ];

        $ageBonus = [
            '20s' => ['nasal' => 15, 'pillow' => 15, 'full' => 0],
            '30s' => ['nasal' => 15, 'pillow' => 10, 'full' => 5],
            '40s' => ['nasal' => 10, 'pillow' => 5, 'full' => 10],
            '50s' => ['nasal' => 5, 'pillow' => 0, 'full' => 15],
            '60s+' => ['nasal' => 0, 'pillow' => 0, 'full' => 20],
        ];
        $ageGroup = is_string($profile['ageGroup'] ?? null) ? $profile['ageGroup'] : '';
        foreach (($ageBonus[$ageGroup] ?? []) as $type => $bonus) {
            $scores[$type]['score'] += $bonus;
        }

        if (! empty($profile['mouthBreathing'])) {
            $scores['full']['score'] += 30;
            $scores['full']['reasons'][] = '구강호흡자에게 필수';
            $scores['nasal']['warnings'][] = '구강호흡 시 비효율적';
            $scores['pillow']['warnings'][] = '구강호흡 시 비효율적';
        } else {
            $scores['nasal']['score'] += 10;
            $scores['pillow']['score'] += 10;
        }

        $pressure = is_string($profile['pressure'] ?? null) ? $profile['pressure'] : '';
        if ($pressure === 'high') {
            $scores['pillow']['score'] -= 30;
            $scores['full']['score'] += 10;
            $scores['full']['reasons'][] = '고압력에 안정적';
        } elseif ($pressure === 'low') {
            $scores['pillow']['score'] += 15;
            $scores['pillow']['reasons'][] = '저압력에 최적화';
        }

        $tossing = is_string($profile['tossing'] ?? null) ? $profile['tossing'] : '';
        if ($tossing === 'high') {
            $scores['pillow']['score'] += 15;
            $scores['pillow']['reasons'][] = '가볍고 움직임에 강함';
            $scores['full']['score'] -= 10;
        }

        if ($noseHeight !== null && $noseHeight > 18) {
            $scores['nasal']['score'] += 10;
            $scores['nasal']['reasons'][] = '높은 코에 적합';
        } elseif ($noseHeight !== null && $noseHeight < 12) {
            $scores['pillow']['score'] += 10;
            $scores['pillow']['reasons'][] = '낮은 코에 편안함';
        }

        if ($philtrumLength !== null && $philtrumLength < 15) {
            $scores['pillow']['score'] += 5;
        }
        if ($mouthWidth !== null && $mouthWidth > 70) {
            $scores['full']['score'] += 10;
            $scores['full']['reasons'][] = '넓은 입에 안정적 밀착';
        }
        if ($bridgeWidth !== null && $bridgeWidth < 30) {
            $scores['pillow']['score'] += 5;
        }

        foreach ($this->preferredTypes($profile) as $preferred) {
            $key = $preferred === 'full' ? 'full' : ($preferred === 'pillow' ? 'pillow' : 'nasal');
            $scores[$key]['score'] += 20;
            $scores[$key]['reasons'][] = '사용자 선호';
        }

        // 최고 점수(0~100 clamp). 동점은 삽입 순서(nasal>pillow>full)로 먼저 등장한 쪽 유지.
        $best = null;
        foreach ($scores as $type => $data) {
            $clamped = max(0, min(100, $data['score']));
            if ($best === null || $clamped > $best['score']) {
                $best = [
                    'type' => $type,
                    'score' => $clamped,
                    'reasons' => $data['reasons'],
                    'warnings' => $data['warnings'],
                ];
            }
        }

        $maskType = MaskType::fromScoreKey($best['type']);

        return [
            'type' => $maskType->value,
            'name' => "{$maskType->displayName()} {$size}",
            'confidence' => $best['score'],
            'reasons' => $best['reasons'] !== []
                ? $best['reasons']
                : ["얼굴 측정 결과 {$size} 사이즈가 적합합니다."],
            'tips' => $best['warnings'] !== []
                ? $best['warnings']
                : ['누운 자세에서 다시 누출 여부를 확인하세요.', '첫 착용 후 2~3일 동안 압박 부위를 확인하세요.'],
        ];
    }

    /**
     * 사이즈 점수 버킷. 값이 없으면(JS undefined 비교가 false) 최상위 버킷(3)으로 처리.
     */
    private function sizeBucket(?float $value, float $low, float $mid): int
    {
        if ($value === null) {
            return 3;
        }
        if ($value < $low) {
            return 1;
        }
        if ($value < $mid) {
            return 2;
        }

        return 3;
    }

    /**
     * 측정값을 안전하게 float 으로 변환. 숫자가 아니면 null(미측정 = 비교 skip).
     *
     * @param  array<string, mixed>  $source
     */
    private function num(array $source, string $key): ?float
    {
        $value = $source[$key] ?? null;
        if (is_int($value) || is_float($value)) {
            return is_finite((float) $value) ? (float) $value : null;
        }
        if (is_string($value) && is_numeric($value)) {
            $float = (float) $value;

            return is_finite($float) ? $float : null;
        }

        return null;
    }

    /**
     * 선호 마스크 타입 목록(문자열만, 최대 5개).
     *
     * @param  array<string, mixed>  $profile
     * @return list<string>
     */
    private function preferredTypes(array $profile): array
    {
        $preferred = $profile['preferredTypes'] ?? [];
        if (! is_array($preferred)) {
            return [];
        }

        $out = [];
        foreach ($preferred as $type) {
            if (is_string($type)) {
                $out[] = $type;
            }
            if (count($out) >= 5) {
                break;
            }
        }

        return $out;
    }
}
