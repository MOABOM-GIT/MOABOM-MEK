const STAR_FILLED = '★';
const STAR_EMPTY = '☆';
const MAX_STARS = 5;

/** 1–5 점수 → `★★★☆☆` 형태 */
export function formatStarGlyphs(rating: number | null | undefined, max = MAX_STARS): string {
  if (rating == null || !Number.isFinite(rating)) {
    return '—';
  }

  const rounded = Math.round(Math.max(0, Math.min(max, rating)));
  if (rounded <= 0) {
    return STAR_EMPTY.repeat(max);
  }

  return STAR_FILLED.repeat(rounded) + STAR_EMPTY.repeat(max - rounded);
}

export function formatRatingSummaryText(avg: number | null | undefined, count: number): string {
  if (avg == null || count <= 0) {
    return '—';
  }

  return `${formatStarGlyphs(avg)} ${avg.toFixed(1)} (${count})`;
}
