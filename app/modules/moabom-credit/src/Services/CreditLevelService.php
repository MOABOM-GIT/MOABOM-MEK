<?php

declare(strict_types=1);

namespace Modules\Moabom\Credit\Services;

/**
 * 활동 누적 포인트(ranking_points) → 레벨 진행도 SSOT.
 *
 * thresholds[i] = Lv.(i+1) 시작 포인트 (길이 10, 비감소).
 */
final class CreditLevelService
{
    public const LEVEL_COUNT = 10;

    /** @var list<string> */
    public const SLUGS = [
        'iron',
        'bronze',
        'silver',
        'gold',
        'platinum',
        'emerald',
        'diamond',
        'master',
        'grandmaster',
        'challenger',
    ];

    /** @var list<int> */
    public const DEFAULT_THRESHOLDS = [
        0,
        100,
        300,
        700,
        1500,
        3000,
        6000,
        12000,
        25000,
        50000,
    ];

    public function __construct(
        private CreditSettingsService $settingsService,
    ) {}

    /**
     * @return array{
     *   level: int,
     *   slug: string,
     *   points: int,
     *   current_threshold: int,
     *   next_threshold: int|null,
     *   progress_ratio: float
     * }
     */
    public function resolve(int $rankingPoints, ?array $thresholds = null): array
    {
        $points = max(0, $rankingPoints);
        $thresholds = $this->normalizeThresholds($thresholds ?? $this->thresholdsFromSettings());

        $levelIndex = 0;
        for ($i = self::LEVEL_COUNT - 1; $i >= 0; $i--) {
            if ($points >= $thresholds[$i]) {
                $levelIndex = $i;
                break;
            }
        }

        $current = $thresholds[$levelIndex];
        $isMax = $levelIndex >= self::LEVEL_COUNT - 1;
        $next = $isMax ? null : $thresholds[$levelIndex + 1];

        if ($isMax || $next === null || $next <= $current) {
            $progress = 1.0;
        } else {
            $progress = ($points - $current) / ($next - $current);
            $progress = max(0.0, min(1.0, $progress));
        }

        return [
            'level' => $levelIndex + 1,
            'slug' => self::SLUGS[$levelIndex],
            'points' => $points,
            'current_threshold' => $current,
            'next_threshold' => $next,
            'progress_ratio' => round($progress, 4),
        ];
    }

    /**
     * @return list<int>
     */
    public function thresholdsFromSettings(): array
    {
        $raw = $this->settingsService->getSetting('levels.thresholds', self::DEFAULT_THRESHOLDS);

        return $this->normalizeThresholds(is_array($raw) ? $raw : self::DEFAULT_THRESHOLDS);
    }

    /**
     * @param  array<int|string, mixed>  $raw
     * @return list<int>
     */
    public function normalizeThresholds(array $raw): array
    {
        $values = [];
        foreach (array_values($raw) as $value) {
            if (! is_numeric($value)) {
                continue;
            }
            $values[] = max(0, (int) $value);
            if (count($values) >= self::LEVEL_COUNT) {
                break;
            }
        }

        if (count($values) < self::LEVEL_COUNT) {
            $values = self::DEFAULT_THRESHOLDS;
        }

        $values[0] = 0;
        for ($i = 1; $i < self::LEVEL_COUNT; $i++) {
            if ($values[$i] < $values[$i - 1]) {
                $values[$i] = $values[$i - 1];
            }
        }

        return $values;
    }
}
