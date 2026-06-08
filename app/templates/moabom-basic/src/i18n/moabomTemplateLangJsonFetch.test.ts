import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildMoabomTemplateLangUrl,
  clearMoabomTemplateLangJsonCache,
  fetchMoabomTemplateLangJson,
  installMoabomTemplateLangFetchDedupe,
  resolveMoabomTemplateLangDictionary,
  resetMoabomTemplateLangFetchDedupeForTest,
} from './moabomTemplateLangJsonFetch';

describe('moabomTemplateLangJsonFetch', () => {
  beforeEach(() => {
    clearMoabomTemplateLangJsonCache();
    resetMoabomTemplateLangFetchDedupeForTest();
    vi.stubGlobal('fetch', vi.fn());
    (window as unknown as { G7Core?: { extensionCacheVersion?: number } }).G7Core = {
      extensionCacheVersion: 99,
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetMoabomTemplateLangFetchDedupeForTest();
  });

  it('buildMoabomTemplateLangUrl 은 extensionCacheVersion 쿼리를 붙인다', () => {
    expect(buildMoabomTemplateLangUrl('ko')).toBe('/api/templates/moabom-basic/lang/ko.json?v=99');
  });

  it('fetchMoabomTemplateLangJson 은 동시 호출을 하나의 fetch 로 합친다', async () => {
    const payload = { moa_shell: { title: '홈' } };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => payload,
    } as Response);

    const [a, b] = await Promise.all([
      fetchMoabomTemplateLangJson('ko'),
      fetchMoabomTemplateLangJson('ko'),
    ]);

    expect(a).toEqual(payload);
    expect(b).toEqual(payload);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/templates/moabom-basic/lang/ko.json?v=99');
  });

  it('resolveMoabomTemplateLangDictionary 는 TranslationEngine 캐시를 우선한다', async () => {
    const enginePayload = { moa_shell: { title: '엔진' } };
    const loadTranslations = vi.fn().mockResolvedValue(enginePayload);

    (window as unknown as {
      G7Core?: {
        extensionCacheVersion?: number;
        getTranslationEngine?: () => unknown;
      };
    }).G7Core = {
      extensionCacheVersion: 99,
      getTranslationEngine: () => ({ loadTranslations }),
    };

    const dict = await resolveMoabomTemplateLangDictionary('ko');

    expect(dict).toEqual(enginePayload);
    expect(loadTranslations).toHaveBeenCalledWith('moabom-basic', 'ko', '/api', false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('installMoabomTemplateLangFetchDedupe 는 v 유무가 다른 lang URL 을 하나로 합친다', async () => {
    const nativeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
      clone: function clone(this: Response) {
        return this;
      },
    } as Response);
    vi.stubGlobal('fetch', nativeFetch);

    installMoabomTemplateLangFetchDedupe();

    await Promise.all([
      fetch('/api/templates/moabom-basic/lang/ko.json?v=99'),
      fetch('/api/templates/moabom-basic/lang/ko.json'),
    ]);

    expect(nativeFetch).toHaveBeenCalledTimes(1);
    expect(nativeFetch.mock.calls[0]?.[0]).toBe('/api/templates/moabom-basic/lang/ko.json?v=99');
  });
});
