/**
 * 브라우저 언어 → Moabom UI 로케일 매핑.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MOABOM_SYSTEM,
  loadMoabomSystemState,
  MOABOM_SYSTEM_STORAGE_KEY,
  resolveMoabomLanguageFromBrowser,
} from './moabomSystemStore';

describe('resolveMoabomLanguageFromBrowser', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('매칭 시 첫 언어 태그 우선순위를 따름', () => {
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      languages: ['pt-BR', 'ja-JP', 'en-US'],
      language: 'ja-JP',
    });
    expect(resolveMoabomLanguageFromBrowser()).toBe('ja');
  });

  it('navigator.languages 가 비어 있으면 navigator.language 만 사용', () => {
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      languages: [],
      language: 'zh-CN',
    });
    expect(resolveMoabomLanguageFromBrowser()).toBe('zh');
  });

  it('ko-KR 형태를 한국어로 인식', () => {
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      languages: ['ko-KR'],
      language: 'ko-KR',
    });
    expect(resolveMoabomLanguageFromBrowser('en')).toBe('ko');
  });

  it('미지원 언어만 있으면 fallback', () => {
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      languages: ['de-DE', 'fr-FR'],
      language: 'de-DE',
    });
    expect(resolveMoabomLanguageFromBrowser('en')).toBe('en');
  });
});

describe('loadMoabomSystemState 브라우저 언어', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('localStorage 비어 있을 때 브라우저 언어 반영', () => {
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      languages: ['en-GB'],
      language: 'en-GB',
    });
    localStorage.removeItem(MOABOM_SYSTEM_STORAGE_KEY);
    const state = loadMoabomSystemState();
    expect(state.preferences.language).toBe('en');
  });

  it('저장된 설정이 있으면 브라우저 무시', () => {
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      languages: ['en-US'],
      language: 'en-US',
    });
    const stored = {
      ...DEFAULT_MOABOM_SYSTEM,
      preferences: {
        ...DEFAULT_MOABOM_SYSTEM.preferences,
        language: 'ja',
      },
    };
    localStorage.setItem(MOABOM_SYSTEM_STORAGE_KEY, JSON.stringify(stored));

    expect(loadMoabomSystemState().preferences.language).toBe('ja');
  });
});
