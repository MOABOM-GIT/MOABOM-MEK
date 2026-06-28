import { describe, expect, it } from 'vitest';
import { formatRatingSummaryText, formatStarGlyphs } from './appCommunityStars';

describe('appCommunityStars', () => {
  it('formatStarGlyphs — 별 개수 표시', () => {
    expect(formatStarGlyphs(5)).toBe('★★★★★');
    expect(formatStarGlyphs(3)).toBe('★★★☆☆');
    expect(formatStarGlyphs(null)).toBe('—');
  });

  it('formatRatingSummaryText — 평균·건수', () => {
    expect(formatRatingSummaryText(5, 1)).toBe('★★★★★ 5.0 (1)');
    expect(formatRatingSummaryText(null, 0)).toBe('—');
  });
});
