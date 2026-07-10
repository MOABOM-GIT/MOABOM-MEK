import { describe, expect, it } from 'vitest';
import {
  activityLevelProgressPercent,
  resolveActivityLevelProgress,
} from './moaActivityLevel';

describe('resolveActivityLevelProgress', () => {
  it('maps boundary points to expected levels', () => {
    expect(resolveActivityLevelProgress(0).level).toBe(1);
    expect(resolveActivityLevelProgress(99).slug).toBe('iron');
    expect(resolveActivityLevelProgress(100).slug).toBe('bronze');
    expect(resolveActivityLevelProgress(50000).slug).toBe('challenger');
    expect(resolveActivityLevelProgress(50001).progress_ratio).toBe(1);
  });

  it('computes mid-tier progress', () => {
    const mid = resolveActivityLevelProgress(200);
    expect(mid.level).toBe(2);
    expect(mid.progress_ratio).toBe(0.5);
    expect(activityLevelProgressPercent(mid)).toBe(50);
  });
});
