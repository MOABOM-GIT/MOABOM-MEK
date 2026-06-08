import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyMoabomSystemAppearance,
  isBrandEnforcedTheme,
  resolveMoabomBrandColor,
} from './moabomSystemStore';

describe('moabomSystemStore / 포인트 컬러와 테마 관계', () => {
  beforeEach(() => {
    // DOM 초기화
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    delete (document.documentElement as any).dataset.moaTheme;
    document.documentElement.style.removeProperty('--moa-point-color');
    document.documentElement.style.removeProperty('--moa-point-rgb');
    document.documentElement.style.removeProperty('--moa-shell-background-image');
  });

  it('모든 테마에서 사용자 선택 포인트 컬러를 그대로 반환한다', () => {
    const userColor = '#6366f1';
    expect(resolveMoabomBrandColor('light', userColor)).toBe(userColor);
    expect(resolveMoabomBrandColor('dark', userColor)).toBe(userColor);
    expect(resolveMoabomBrandColor('flat-light', userColor)).toBe(userColor);
    expect(resolveMoabomBrandColor('flat-dark', userColor)).toBe(userColor);
  });

  it('성능(flat-*) 테마에서도 브랜드 컬러를 강제하지 않는다', () => {
    expect(isBrandEnforcedTheme('flat-light')).toBe(false);
    expect(isBrandEnforcedTheme('flat-dark')).toBe(false);
    expect(isBrandEnforcedTheme('light')).toBe(false);
    expect(isBrandEnforcedTheme('dark')).toBe(false);
  });

  it('잘못된 hex 가 들어오면 기본 포인트 컬러로 폴백한다', () => {
    const fallback = resolveMoabomBrandColor('flat-light', 'not-a-color');
    expect(fallback).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('applyMoabomSystemAppearance 는 활성 테마와 무관하게 사용자 포인트 컬러를 CSS 변수로 적용한다', () => {
    const userColor = '#ff0088';

    applyMoabomSystemAppearance({ theme: 'flat-light', pointColor: userColor, backgroundImageId: '', fontSize: 3 });
    expect(document.documentElement.style.getPropertyValue('--moa-point-color')).toBe(userColor);

    applyMoabomSystemAppearance({ theme: 'flat-dark', pointColor: userColor, backgroundImageId: '', fontSize: 3 });
    expect(document.documentElement.style.getPropertyValue('--moa-point-color')).toBe(userColor);

    applyMoabomSystemAppearance({ theme: 'light', pointColor: userColor, backgroundImageId: '', fontSize: 3 });
    expect(document.documentElement.style.getPropertyValue('--moa-point-color')).toBe(userColor);

    applyMoabomSystemAppearance({ theme: 'dark', pointColor: userColor, backgroundImageId: '', fontSize: 3 });
    expect(document.documentElement.style.getPropertyValue('--moa-point-color')).toBe(userColor);
  });

  it('applyMoabomSystemAppearance 는 다크 계열 테마(dark, flat-dark)에만 dark 클래스를 붙인다', () => {
    applyMoabomSystemAppearance({ theme: 'light', pointColor: '#6366f1', backgroundImageId: '', fontSize: 3 });
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    applyMoabomSystemAppearance({ theme: 'flat-light', pointColor: '#6366f1', backgroundImageId: '', fontSize: 3 });
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    applyMoabomSystemAppearance({ theme: 'dark', pointColor: '#6366f1', backgroundImageId: '', fontSize: 3 });
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    applyMoabomSystemAppearance({ theme: 'flat-dark', pointColor: '#6366f1', backgroundImageId: '', fontSize: 3 });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
