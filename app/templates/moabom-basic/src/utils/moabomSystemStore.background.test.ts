/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_MOABOM_SYSTEM,
  MOABOM_SYSTEM_STORAGE_KEY,
  normalizeMoabomSystemState,
} from './moabomSystemStore';

describe('MoabomSystemState 배경', () => {
  afterEach(() => {
    localStorage.removeItem(MOABOM_SYSTEM_STORAGE_KEY);
  });

  it('normalize: appearance에 backgroundImageId 없으면 베이스 유지', () => {
    const base = DEFAULT_MOABOM_SYSTEM;
    const next = normalizeMoabomSystemState(
      { appearance: { theme: 'dark', pointColor: '#112233' } },
      base,
    );
    expect(next.appearance.backgroundImageId).toBe(base.appearance.backgroundImageId);
  });

  it('normalize: 잘못된 backgroundImageId 는 베이스로 대체', () => {
    const base = DEFAULT_MOABOM_SYSTEM;
    const next = normalizeMoabomSystemState(
      { appearance: { backgroundImageId: '0' } },
      base,
    );
    expect(next.appearance.backgroundImageId).toBe(base.appearance.backgroundImageId);
  });

  it('normalize: 업로드 UUID backgroundImageId 유지', () => {
    const base = DEFAULT_MOABOM_SYSTEM;
    const next = normalizeMoabomSystemState(
      { appearance: { backgroundImageId: '550e8400-e29b-41d4-a716-446655440000' } },
      base,
    );
    expect(next.appearance.backgroundImageId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });
});
