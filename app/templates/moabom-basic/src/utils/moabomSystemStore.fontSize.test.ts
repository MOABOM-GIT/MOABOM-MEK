import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_FONT_SIZE_LEVEL,
  DEFAULT_MOABOM_SYSTEM,
  FONT_SIZE_LEVEL_PX,
  applyMoabomSystemAppearance,
  defaultsToSystemState,
  normalizeFontSizeLevel,
  normalizeMoabomSystemState,
} from './moabomSystemStore';

describe('moabomSystemStore / 글자 크기(fontSize)', () => {
  beforeEach(() => {
    document.documentElement.style.removeProperty('font-size');
  });

  it('기본 글자 크기 단계는 2 이다', () => {
    expect(DEFAULT_FONT_SIZE_LEVEL).toBe(2);
    expect(DEFAULT_MOABOM_SYSTEM.appearance.fontSize).toBe(2);
  });

  it('normalizeFontSizeLevel 은 1~5 범위만 허용하고 나머지는 fallback 으로 대체한다', () => {
    expect(normalizeFontSizeLevel(1)).toBe(1);
    expect(normalizeFontSizeLevel(5)).toBe(5);
    expect(normalizeFontSizeLevel('4')).toBe(4);
    expect(normalizeFontSizeLevel(3.4)).toBe(3);
    expect(normalizeFontSizeLevel(0)).toBe(DEFAULT_FONT_SIZE_LEVEL);
    expect(normalizeFontSizeLevel(6)).toBe(DEFAULT_FONT_SIZE_LEVEL);
    expect(normalizeFontSizeLevel('big')).toBe(DEFAULT_FONT_SIZE_LEVEL);
    expect(normalizeFontSizeLevel(undefined, 2)).toBe(2);
  });

  it('normalizeMoabomSystemState 는 잘못된 fontSize 를 base 값으로 대체한다', () => {
    const next = normalizeMoabomSystemState(
      { appearance: { fontSize: 99 } },
      DEFAULT_MOABOM_SYSTEM,
    );
    expect(next.appearance.fontSize).toBe(DEFAULT_MOABOM_SYSTEM.appearance.fontSize);

    const valid = normalizeMoabomSystemState(
      { appearance: { fontSize: 5 } },
      DEFAULT_MOABOM_SYSTEM,
    );
    expect(valid.appearance.fontSize).toBe(5);
  });

  it('defaultsToSystemState 는 관리자 font_size_default 를 baseline 으로 시드한다', () => {
    expect(defaultsToSystemState({ appearance: { font_size_default: 4 } }).appearance.fontSize).toBe(4);
    expect(defaultsToSystemState({ appearance: { font_size_default: 42 } }).appearance.fontSize).toBe(DEFAULT_FONT_SIZE_LEVEL);
    expect(defaultsToSystemState(undefined).appearance.fontSize).toBe(DEFAULT_FONT_SIZE_LEVEL);
  });

  it('applyMoabomSystemAppearance 는 루트 html font-size 를 단계별 px 로 적용한다', () => {
    applyMoabomSystemAppearance({ theme: 'light', pointColor: '#6366f1', backgroundImageId: '', fontSize: 3 });
    expect(document.documentElement.style.fontSize).toBe(`${FONT_SIZE_LEVEL_PX[3]}px`);

    applyMoabomSystemAppearance({ theme: 'light', pointColor: '#6366f1', backgroundImageId: '', fontSize: 5 });
    expect(document.documentElement.style.fontSize).toBe(`${FONT_SIZE_LEVEL_PX[5]}px`);
  });

  it('레벨→px 매핑은 한 단계당 1px 씩 증가한다 (3=17px 기본)', () => {
    expect(FONT_SIZE_LEVEL_PX).toEqual({ 1: 15, 2: 16, 3: 17, 4: 18, 5: 19 });
  });
});
