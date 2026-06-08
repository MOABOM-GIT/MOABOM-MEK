import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  __resetMoabomPublicFrontendDefaultsCacheForTest,
  fetchMoabomPublicFrontendDefaults,
} from './moabomSystemApi';

describe('fetchMoabomPublicFrontendDefaults', () => {
  afterEach(() => {
    __resetMoabomPublicFrontendDefaultsCacheForTest();
    vi.restoreAllMocks();
  });

  it('동시에 들어온 public defaults 요청은 하나의 fetch를 공유한다', async () => {
    let resolveResponse!: () => void;
    const responseReady = new Promise<void>((resolve) => {
      resolveResponse = resolve;
    });

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      await responseReady;
      return new Response(JSON.stringify({
        success: true,
        data: {
          defaults: {
            appearance: {
              themes: [],
              point_color_presets: [],
              home_background_items: [],
            },
          },
          defaults_revision: 7,
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const first = fetchMoabomPublicFrontendDefaults();
    const second = fetchMoabomPublicFrontendDefaults();
    resolveResponse();

    const [a, b] = await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.ok).toBe(true);
    expect(b.defaults_revision).toBe(7);
  });

  it('성공 응답은 짧은 메모리 TTL 안에서 재사용한다', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: {
        defaults: {
          appearance: {
            themes: [],
            point_color_presets: [],
            home_background_items: [],
          },
        },
        defaults_revision: 9,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const first = await fetchMoabomPublicFrontendDefaults();
    const second = await fetchMoabomPublicFrontendDefaults();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.defaults_revision).toBe(9);
    expect(second.defaults_revision).toBe(9);
  });
});
