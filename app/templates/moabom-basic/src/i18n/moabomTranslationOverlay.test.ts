import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as langFetch from './moabomTemplateLangJsonFetch';
import {
  clearMoabomTranslationOverlay,
  loadMoabomTranslationOverlay,
  lookupMoabomOverlay,
} from './moabomTranslationOverlay';

describe('loadMoabomTranslationOverlay', () => {
  beforeEach(() => {
    clearMoabomTranslationOverlay();
    vi.spyOn(langFetch, 'resolveMoabomTemplateLangDictionary').mockResolvedValue({
      moa_shell: { center: { title: '중앙' } },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearMoabomTranslationOverlay();
  });

  it('resolveMoabomTemplateLangDictionary 결과를 flat 오버레이로 적용한다', async () => {
    await loadMoabomTranslationOverlay('ko');

    expect(langFetch.resolveMoabomTemplateLangDictionary).toHaveBeenCalledWith('ko');
    expect(lookupMoabomOverlay('moa_shell.center.title')).toBe('중앙');
  });
});
