/**
 * ImageGallery 라이트박스 지연 청크 로더 테스트
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function stubComponentsScriptQuery(): void {
  const fake = { getAttribute: () => '/api/templates/assets/moabom-basic/js/components.iife.js?v=fixture-v' };
  const list = {
    length: 1,
    0: fake,
    item: (i: number) => (i === 0 ? fake : null),
    *[Symbol.iterator]() {
      yield fake;
    },
  } as unknown as NodeListOf<Element>;
  const orig = document.querySelectorAll.bind(document);
  vi.spyOn(document, 'querySelectorAll').mockImplementation((selectors) => {
    if (typeof selectors === 'string' && selectors.includes('components.iife')) {
      return list;
    }
    return orig(selectors as string);
  });
}

describe('ensureImageGalleryLightboxLoaded', () => {
  beforeEach(() => {
    delete (window as unknown as { __MoabomImageGalleryLightboxInner?: unknown }).__MoabomImageGalleryLightboxInner;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as unknown as { __MoabomImageGalleryLightboxInner?: unknown }).__MoabomImageGalleryLightboxInner;
  });

  it('이미 등록된 컴포넌트가 있으면 스크립트를 추가하지 않고 resolve', async () => {
    vi.resetModules();
    stubComponentsScriptQuery();
    const fake = (): null => null;
    (window as unknown as { __MoabomImageGalleryLightboxInner: typeof fake }).__MoabomImageGalleryLightboxInner = fake;
    const append = vi.spyOn(document.head, 'appendChild');
    const { ensureImageGalleryLightboxLoaded } = await import('./moabomImageGalleryLightboxChunk');
    const Comp = await ensureImageGalleryLightboxLoaded();
    expect(Comp).toBe(fake);
    const scriptAppends = append.mock.calls.filter((c) => (c[0] as HTMLElement)?.tagName === 'SCRIPT');
    expect(scriptAppends.length).toBe(0);
  });

  it('스크립트 로드 후 window에 등록된 컴포넌트로 resolve', async () => {
    vi.resetModules();
    stubComponentsScriptQuery();
    const fake = (): null => null;
    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      const el = node as HTMLScriptElement;
      if (el.tagName === 'SCRIPT' && el.src.includes('image-gallery-lightbox')) {
        expect(el.src).toContain('fixture-v');
        (window as unknown as { __MoabomImageGalleryLightboxInner: typeof fake }).__MoabomImageGalleryLightboxInner =
          fake;
        el.onload?.(new Event('load'));
      }
      return node;
    });
    const { ensureImageGalleryLightboxLoaded } = await import('./moabomImageGalleryLightboxChunk');
    const Comp = await ensureImageGalleryLightboxLoaded();
    expect(Comp).toBe(fake);
  });
});
