export type ActivityRankSlug =
  | 'iron'
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'emerald'
  | 'diamond'
  | 'master'
  | 'grandmaster'
  | 'challenger';

export type ActivityLevelProgress = {
  level: number;
  slug: ActivityRankSlug;
  points: number;
  current_threshold: number;
  next_threshold: number | null;
  progress_ratio: number;
};

export const ACTIVITY_RANK_SLUGS: readonly ActivityRankSlug[] = [
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
] as const;

export const ACTIVITY_RANK_ICONS: Record<ActivityRankSlug, string> = {
  iron: 'shield',
  bronze: 'medal',
  silver: 'award',
  gold: 'trophy',
  platinum: 'gem',
  emerald: 'leaf',
  diamond: 'gem',
  master: 'crown',
  grandmaster: 'star',
  challenger: 'bolt',
};

/** 기본 구간 — 서버 settings와 동기. 클라이언트 폴백 전용. */
export const DEFAULT_ACTIVITY_LEVEL_THRESHOLDS = [
  0, 100, 300, 700, 1500, 3000, 6000, 12000, 25000, 50000,
] as const;

export function resolveActivityRankSlug(level: number): ActivityRankSlug {
  const index = Math.min(Math.max(level, 1), ACTIVITY_RANK_SLUGS.length) - 1;
  return ACTIVITY_RANK_SLUGS[index] ?? 'iron';
}

export function resolveActivityLevelProgress(
  points: number,
  thresholds: readonly number[] = DEFAULT_ACTIVITY_LEVEL_THRESHOLDS,
): ActivityLevelProgress {
  const safePoints = Math.max(0, Math.floor(points));
  const values = thresholds.length >= 10
    ? thresholds.slice(0, 10).map((v) => Math.max(0, Math.floor(Number(v) || 0)))
    : [...DEFAULT_ACTIVITY_LEVEL_THRESHOLDS];

  values[0] = 0;
  for (let i = 1; i < values.length; i += 1) {
    if (values[i]! < values[i - 1]!) {
      values[i] = values[i - 1]!;
    }
  }

  let levelIndex = 0;
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (safePoints >= values[i]!) {
      levelIndex = i;
      break;
    }
  }

  const current = values[levelIndex]!;
  const isMax = levelIndex >= values.length - 1;
  const next = isMax ? null : values[levelIndex + 1]!;
  let progressRatio = 1;
  if (!isMax && next != null && next > current) {
    progressRatio = Math.max(0, Math.min(1, (safePoints - current) / (next - current)));
  }

  return {
    level: levelIndex + 1,
    slug: ACTIVITY_RANK_SLUGS[levelIndex] ?? 'iron',
    points: safePoints,
    current_threshold: current,
    next_threshold: next,
    progress_ratio: Math.round(progressRatio * 10000) / 10000,
  };
}

export function activityLevelProgressPercent(level: ActivityLevelProgress | null | undefined): number {
  if (!level) {
    return 0;
  }
  return Math.round(Math.max(0, Math.min(1, level.progress_ratio)) * 100);
}
