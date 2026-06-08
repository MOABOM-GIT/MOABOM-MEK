import { describe, expect, it } from 'vitest';
import {
  buildAuthLanguageSelectOptions,
  normalizeRegisterUiLanguage,
} from './moabomAuthLanguage';

const identityT = (key: string) => key;

describe('moabomAuthLanguage', () => {
  it('normalizeRegisterUiLanguage keeps supported UI languages', () => {
    expect(normalizeRegisterUiLanguage('ko')).toBe('ko');
    expect(normalizeRegisterUiLanguage('en')).toBe('en');
    expect(normalizeRegisterUiLanguage('ja')).toBe('ja');
    expect(normalizeRegisterUiLanguage('zh')).toBe('zh');
  });

  it('normalizeRegisterUiLanguage falls back to ko for unknown values', () => {
    expect(normalizeRegisterUiLanguage('fr')).toBe('ko');
  });

  it('buildAuthLanguageSelectOptions returns four UI languages', () => {
    const options = buildAuthLanguageSelectOptions(identityT);
    expect(options).toHaveLength(4);
    expect(options.map((o) => o.value)).toEqual(['ko', 'en', 'ja', 'zh']);
  });
});
