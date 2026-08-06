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

  it('약관 전용 API가 404이면 발행 페이지 API로 대체 조회한다', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, message: '페이지를 찾을 수 없습니다.' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 2,
            slug: 'privacy',
            title: '개인정보처리방침',
            content: '<p>개인정보 본문</p>',
            content_mode: 'html',
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const out = await fetchPublishedSirsoftPage('privacy');

    expect(out.title).toBe('개인정보처리방침');
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/modules/sirsoft-page/pages/privacy',
      expect.objectContaining({ method: 'GET', credentials: 'same-origin' }),
    );
  });
});
