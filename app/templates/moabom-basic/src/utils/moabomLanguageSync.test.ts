/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  alignMoabomPreferenceWithCoreProfile,
  coreSyncLanguageFromMoabomPref,
  isMoabomSystemStateLanguageOnlyChange,
} from './moabomLanguageSync';
import type { MoabomSystemState } from '../types/moabomSystem';

vi.mock('./moabomLocaleCatalog', () => ({
  getMoabomLocaleCatalog: vi.fn(() => ({
    supported_locales: ['ko', 'en', 'ja', 'zh'],
    locale_names: {},
    ui_locales: ['ko', 'en', 'ja', 'zh'],
    ui_locale_names: {},
  })),
}));

describe('moabomLanguageSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses same code when locale is in supported_locales', () => {
    expect(coreSyncLanguageFromMoabomPref('ja')).toBe('ja');
    expect(coreSyncLanguageFromMoabomPref('zh')).toBe('zh');
    expect(coreSyncLanguageFromMoabomPref('ko')).toBe('ko');
    expect(coreSyncLanguageFromMoabomPref('en')).toBe('en');
  });

  it('keeps ja when core remains en', () => {
    expect(alignMoabomPreferenceWithCoreProfile('ja', 'en')).toBe('ja');
  });

  it('keeps ja when core is still ko (profile en sync lag)', () => {
    expect(alignMoabomPreferenceWithCoreProfile('ja', 'ko')).toBe('ja');
  });

  it('keeps zh when core is still ko', () => {
    expect(alignMoabomPreferenceWithCoreProfile('zh', 'ko')).toBe('zh');
  });

  it('keeps ko when core is still en (profile ko sync lag)', () => {
    expect(alignMoabomPreferenceWithCoreProfile('ko', 'en')).toBe('ko');
  });

  it('returns pref when core unknown', () => {
    expect(alignMoabomPreferenceWithCoreProfile('ko', undefined)).toBe('ko');
    expect(alignMoabomPreferenceWithCoreProfile('ja', 'xx')).toBe('ja');
  });

  const sampleState = (language: MoabomSystemState['preferences']['language']): MoabomSystemState => ({
    version: 1,
    layout: {
      leftPanelOpen: true,
      rightPanelOpen: false,
      centerMode: 'moabom-apps',
    },
    appearance: { theme: 'light', pointColor: '#112233', backgroundImageId: '', fontSize: 3 },
    preferences: {
      language,
      systemOptions: {
        sound: true,
        animation: false,
        haptic: true,
        toast: true,
        weather: false,
      },
    },
  });

  it('detects language-only preference change', () => {
    const a = sampleState('ko');
    const b = sampleState('en');
    expect(isMoabomSystemStateLanguageOnlyChange(a, b)).toBe(true);
  });

  it('returns false when language unchanged', () => {
    const a = sampleState('ko');
    expect(isMoabomSystemStateLanguageOnlyChange(a, sampleState('ko'))).toBe(false);
  });

  it('returns false when theme changes together', () => {
    const a = sampleState('ko');
    const b = {
      ...sampleState('en'),
      appearance: { theme: 'dark' as const, pointColor: '#112233', backgroundImageId: '', fontSize: 3 as const },
    };
    expect(isMoabomSystemStateLanguageOnlyChange(a, b)).toBe(false);
  });
});
