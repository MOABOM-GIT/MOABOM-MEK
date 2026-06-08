import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPublishedSirsoftPage } from './moabomSirsoftPageApi';

describe('fetchPublishedSirsoftPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('성공 응답에서 data 객체를 반환한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { id: 1, slug: 'terms', title: '이용약관', content: '<p>본문</p>', content_mode: 'html' },
        }),
      }),
    );

    const out = await fetchPublishedSirsoftPage('terms');
    expect(out.title).toBe('이용약관');
    expect(out.content).toContain('본문');
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/modules/moabom-system/public/legal-pages/terms',
      expect.objectContaining({ method: 'GET', credentials: 'same-origin' }),
    );
  });

  it('success가 false이면 예외를 던진다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: 404,
        json: async () => ({ success: false, message: '없음' }),
      }),
    );

    await expect(fetchPublishedSirsoftPage('none')).rejects.toThrow('없음');
  });
});
