import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  installMoabomUserShellStateFetch,
  prefetchMoabomUserShellState,
  resetMoabomUserShellStateForTest,
} from './moabomUserShellState';

describe('moabomUserShellState', () => {
  beforeEach(() => {
    localStorage.clear();
    resetMoabomUserShellStateForTest();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    resetMoabomUserShellStateForTest();
    vi.restoreAllMocks();
  });

  it('인증 셸 critical 상태를 토큰과 함께 선로드한다', async () => {
    localStorage.setItem('auth_token', 'token-a');
    const fetchMock = vi.spyOn(window, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: {
        settings: {
          settings: {
            shell: {
              home: {
                mainAppOrder: ['mypage'],
                mainAppOrderCustomized: true,
              },
            },
          },
        },
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const result = await prefetchMoabomUserShellState();

    expect(result?.settings).toBeDefined();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/modules/moabom-system/user/shell-state?scope=critical',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-a',
        }),
      }),
    );
  });

  it('슬라이스 요청이 full shell-state 집계를 유발하지 않는다', async () => {
    localStorage.setItem('auth_token', 'token-a');
    const fetchMock = vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/modules/moabom-system/user/shell-state?scope=critical') {
        return new Response(JSON.stringify({
          success: true,
          data: { settings: { settings: {} } },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url === '/api/user/notifications/unread-count') {
        return new Response(JSON.stringify({
          success: true,
          data: { unread_count: 3 },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`예상하지 않은 요청: ${url}`);
    });

    installMoabomUserShellStateFetch();
    const response = await window.fetch('/api/user/notifications/unread-count');
    const payload = await response.json();

    expect(payload.data.unread_count).toBe(3);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/modules/moabom-system/user/shell-state?scope=critical',
      expect.any(Object),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/modules/moabom-system/user/shell-state',
      expect.anything(),
    );
  });
});
