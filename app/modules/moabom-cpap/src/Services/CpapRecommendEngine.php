<?php

namespace Modules\Moabom\Cpap\Services;

use Modules\Moabom\Cpap\Enums\MaskType;

/**
 * CPAP 마스크 추천 알고리즘 (서버 권위).
 *
 * 규칙 계수 SSOT: resources/recommend-rules.json
 * 프론트 recommendMask (cpapRecommendMask.ts) 와 1:1 동작.
 */
class CpapRecommendEngine
{
    /** @var array<string, mixed> */
    private array $rules;

    public function __construct()
    {
        $this->rules = (array) config('moabom-cpap.recommend_rules', []);
    }

    /**
     * @param  array<string, mixed>  $profile
     * @param  array<string, mixed>  $measurements
     * @param  array<string, mixed>  $profileMeasurements
     * @return array{type: string, name: string, confidence: int, reasons: list<string>, tips: list<string>}
     */
    public function recommend(array $profile, array $measurements, array $profileMeasurements): array
    {
        $noseWidth = $this->num($measurements, 'noseWidth');
        $faceLength = $this->num($measurements, 'faceLength');
        $faceWidth = $this->num($measurements, 'faceWidth');
        $mouthWidth = $this->num($measurements, 'mouthWidth');
        $philtrumLength = $this->num($measurements, 'philtrumLength');
        $bridgeWidth = $this->num($measurements, 'bridgeWidth');
        $noseHeight = $this->num($profileMeasurements, 'noseHeight');

        $buckets = (array) ($this->rules['size_buckets'] ?? []);
        $sizeScore = $this->sizeBucket($noseWidth, $buckets['nose_width'] ?? null)
            + $this->sizeBucket($faceLength, $buckets['face_length'] ?? null)
            + $this->sizeBucket($faceWidth, $buckets['face_width'] ?? null)
            + $this->sizeBucket($mouthWidth, $buckets['mouth_width'] ?? null);
        $size = $this->resolveSizeLabel($sizeScore);

        $baseScore = (int) ($this->rules['base_score'] ?? 50);
        $scores = [
            'nasal' => ['score' => $baseScore, 'reasons' => [], 'warnings' => []],
            'pillow' => ['score' => $baseScore, 'reasons' => [], 'warnings' => []],
            'full' => ['score' => $baseScore, 'reasons' => [], 'warnings' => []],
        ];

        $ageGroup = is_string($profile['ageGroup'] ?? null) ? $profile['ageGroup'] : '';
        $ageBonus = (array) (($this->rules['age_bonus'] ?? [])[$ageGroup] ?? []);
        foreach ($ageBonus as $type => $bonus) {
            if (isset($scores[$type])) {
                $scores[$type]['score'] += (int) $bonus;
            }
        }

        $mouthRules = (array) ($this->rules['mouth_breathing'] ?? []);
        if (! empty($profile['mouthBreathing'])) {
            $trueRules = (array) ($mouthRules['true'] ?? []);
            $scores['full']['score'] += (int) ($trueRules['full_score'] ?? 0);
            if (isset($trueRules['full_reason'])) {
                $scores['full']['reasons'][] = (string) $trueRules['full_reason'];
            }
            if (isset($trueRules['nasal_warning'])) {
                $scores['nasal']['warnings'][] = (string) $trueRules['nasal_warning'];
            }
            if (isset($trueRules['pillow_warning'])) {
                $scores['pillow']['warnings'][] = (string) $trueRules['pillow_warning'];
            }
        } else {
            $falseRules = (array) ($mouthRules['false'] ?? []);
            $scores['nasal']['score'] += (int) ($falseRules['nasal_score'] ?? 0);
            $scores['pillow']['score'] += (int) ($falseRules['pillow_score'] ?? 0);
        }

        $pressure = is_string($profile['pressure'] ?? null) ? $profile['pressure'] : '';
        $pressureRules = (array) (($this->rules['pressure'] ?? [])[$pressure] ?? []);
        foreach (['pillow', 'full'] as $type) {
            $key = "{$type}_score";
            if (array_key_exists($key, $pressureRules)) {
                $scores[$type]['score'] += (int) $pressureRules[$key];
            }
            $reasonKey = "{$type}_reason";
            if (isset($pressureRules[$reasonKey])) {
                $scores[$type]['reasons'][] = (string) $pressureRules[$reasonKey];
            }
        }

        $tossing = is_string($profile['tossing'] ?? null) ? $profile['tossing'] : '';
        $tossingRules = (array) (($this->rules['tossing'] ?? [])[$tossing] ?? []);
        foreach (['pillow', 'full'] as $type) {
            $key = "{$type}_score";
            if (array_key_exists($key, $tossingRules)) {
                $scores[$type]['score'] += (int) $tossingRules[$key];
            }
            $reasonKey = "{$type}_reason";
            if (isset($tossingRules[$reasonKey])) {
                $scores[$type]['reasons'][] = (string) $tossingRules[$reasonKey];
            }
        }

        $adjustments = (array) ($this->rules['measurement_adjustments'] ?? []);
        $this->applyMeasurementAdjustment($scores, $adjustments['nose_height_high'] ?? null, $noseHeight, 'gt');
        $this->applyMeasurementAdjustment($scores, $adjustments['nose_height_low'] ?? null, $noseHeight, 'lt');
        $this->applyMeasurementAdjustment($scores, $adjustments['philtrum_length'] ?? null, $philtrumLength, 'lt');
        $this->applyMeasurementAdjustment($scores, $adjustments['mouth_width'] ?? null, $mouthWidth, 'gt');
        $this->applyMeasurementAdjustment($scores, $adjustments['bridge_width'] ?? null, $bridgeWidth, 'lt');

        $preferredRules = (array) ($this->rules['preferred_type'] ?? []);
        $bonus = (int) ($preferredRules['score_bonus'] ?? 20);
        $reason = (string) ($preferredRules['reason'] ?? '사용자 선호');
        $maxCount = (int) ($preferredRules['max_count'] ?? 5);
        foreach ($this->preferredTypes($profile, $maxCount) as $preferred) {
            $key = $preferred === 'full' ? 'full' : ($preferred === 'pillow' ? 'pillow' : 'nasal');
            $scores[$key]['score'] += $bonus;
            $scores[$key]['reasons'][] = $reason;
        }

        $clamp = (array) ($this->rules['score_clamp'] ?? ['min' => 0, 'max' => 100]);
        $min = (int) ($clamp['min'] ?? 0);
        $max = (int) ($clamp['max'] ?? 100);
        $order = (array) ($this->rules['score_order'] ?? ['nasal', 'pillow', 'full']);

        $best = null;
        foreach ($order as $type) {
            if (! isset($scores[$type])) {
                continue;
            }
            $data = $scores[$type];
            $clamped = max($min, min($max, $data['score']));
            if ($best === null || $clamped > $best['score']) {
                $best = [
                    'type' => $type,
                    'score' => $clamped,
                    'reasons' => $data['reasons'],
                    'warnings' => $data['warnings'],
                ];
            }
        }

        $maskType = MaskType::fromScoreKey($best['type'] ?? 'nasal');
        $defaults = (array) ($this->rules['defaults'] ?? []);
        $reasonTemplate = (string) ($defaults['reason_template'] ?? '얼굴 측정 결과 {size} 사이즈가 적합합니다.');
        $defaultTips = (array) ($defaults['tips'] ?? []);

        return [
            'type' => $maskType->value,
            'name' => "{$maskType->displayName()} {$size}",
            'confidence' => $best['score'] ?? $baseScore,
            'reasons' => ($best['reasons'] ?? []) !== []
                ? $best['reasons']
                : [str_replace('{size}', $size, $reasonTemplate)],
            'tips' => ($best['warnings'] ?? []) !== []
                ? $best['warnings']
                : array_map('strval', $defaultTips),
        ];
    }

    /**
     * @param  array<string, mixed>|null  $bucket
     */
    private function sizeBucket(?float $value, ?array $bucket): int
    {
        $missing = (int) ($this->rules['missing_measurement_bucket'] ?? 3);
        if ($bucket === null) {
            return $missing;
        }
        if ($value === null) {
            return $missing;
        }

        $low = (float) ($bucket['low'] ?? 0);
        $mid = (float) ($bucket['mid'] ?? 0);
        if ($value < $low) {
            return 1;
        }
        if ($value < $mid) {
            return 2;
        }

        return 3;
    }

    private function resolveSizeLabel(int $sizeScore): string
    {
        $labels = (array) ($this->rules['size_labels'] ?? []);
        $smallMax = (int) ($labels['small_max_score'] ?? 6);
        $mediumMax = (int) ($labels['medium_max_score'] ?? 10);

        if ($sizeScore <= $smallMax) {
            return (string) ($labels['small'] ?? 'S');
        }
        if ($sizeScore <= $mediumMax) {
            return (string) ($labels['medium'] ?? 'M');
        }

        return (string) ($labels['large'] ?? 'L');
    }

    /**
     * @param  array<string, array{score: int, reasons: list<string>, warnings: list<string>}>  $scores
     * @param  array<string, mixed>|null  $rule
     */
    private function applyMeasurementAdjustment(array &$scores, ?array $rule, ?float $value, string $defaultCompare): void
    {
        if ($rule === null || $value === null) {
            return;
        }

        $threshold = (float) ($rule['threshold'] ?? 0);
        $compare = (string) ($rule['compare'] ?? $defaultCompare);
        $matches = match ($compare) {
            'lt' => $value < $threshold,
            'gt' => $value > $threshold,
            default => false,
        };
        if (! $matches) {
            return;
        }

        $type = (string) ($rule['type'] ?? '');
        if (! isset($scores[$type])) {
            return;
        }

        $scores[$type]['score'] += (int) ($rule['score'] ?? 0);
        if (isset($rule['reason'])) {
            $scores[$type]['reasons'][] = (string) $rule['reason'];
        }
    }

    /**
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
     * @param  array<string, mixed>  $profile
     * @return list<string>
     */
    private function preferredTypes(array $profile, int $maxCount): array
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
            if (count($out) >= $maxCount) {
                break;
            }
        }

        return $out;
    }
}
