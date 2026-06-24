import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MoabomShellAuthExpiredError,
  MoabomShellAuthRequiredError,
  MoabomShellModuleApiError,
  requestShellJson,
} from './moabomShellHttp';
import { clearShellAccessToken, setShellAccessToken } from './moabomShellAccess';

describe('moabomShellHttp', () => {
  beforeEach(() => {
    (window as { G7Core?: unknown }).G7Core = {
      api: {
        getToken: () => localStorage.getItem('auth_token'),
        setToken: (token: string) => localStorage.setItem('auth_token', token),
        removeToken: () => localStorage.removeItem('auth_token'),
      },
      AuthManager: {
        getInstance: () => ({
          refreshToken: vi.fn().mockResolvedValue(false),
        }),
      },
    };
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('required 모드에서 토큰이 없으면 네트워크 없이 SHELL_AUTH_REQUIRED', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    await expect(requestShellJson('/api/modules/test/apps/foo', 'required'))
      .rejects
      .toBeInstanceOf(MoabomShellAuthRequiredError);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('optional 모드는 토큰 없이도 요청한다', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: { ok: true },
    }), { status: 200 }));

    const data = await requestShellJson<{ ok: boolean }>('/api/modules/test/public', 'optional');

    expect(data.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Headers).get('Authorization')).toBeNull();
  });

  it('required 모드 401 시 전역 리다이렉트 없이 토큰을 제거하고 SHELL_AUTH_EXPIRED', async () => {
    setShellAccessToken('stale-token');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      success: false,
      message: 'Unauthenticated',
    }), { status: 401 }));

    await expect(requestShellJson('/api/modules/test/apps/foo', 'required'))
      .rejects
      .toBeInstanceOf(MoabomShellAuthExpiredError);

    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('401 후 refresh 성공 시 한 번 재시도한다', async () => {
    setShellAccessToken('expired');

    const refreshToken = vi.fn().mockResolvedValueOnce(true);
    (window as {
      G7Core?: {
        api?: {
          getToken: () => string | null;
          setToken: (token: string) => void;
          removeToken: () => void;
        };
        AuthManager?: { getInstance?: () => { refreshToken: () => Promise<boolean> } };
      };
    }).G7Core = {
      api: {
        getToken: () => localStorage.getItem('auth_token'),
        setToken: (token: string) => localStorage.setItem('auth_token', token),
        removeToken: () => localStorage.removeItem('auth_token'),
      },
      AuthManager: {
        getInstance: () => ({ refreshToken }),
      },
    };

    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: false }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: { value: 42 },
      }), { status: 200 }));

    localStorage.setItem('auth_token', 'fresh-token');

    const data = await requestShellJson<{ value: number }>('/api/modules/test/apps/foo', 'required');

    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(data.value).toBe(42);
  });

  it('clearShellAccessToken 은 G7 api.removeToken 을 사용한다', () => {
    const removeToken = vi.fn();
    (window as { G7Core?: { api?: { removeToken?: () => void } } }).G7Core = {
      api: { removeToken },
    };

    clearShellAccessToken();
    expect(removeToken).toHaveBeenCalledTimes(1);
  });

  it('모듈 API 실패 시 MoabomShellModuleApiError 와 reason 을 노출한다', async () => {
    setShellAccessToken('token');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      success: false,
      message: 'Already friends',
      errors: { reason: 'friendship_already_exists' },
    }), { status: 422 }));

    await expect(requestShellJson('/api/modules/moabom-presence/user/friends', 'required'))
      .rejects
      .toMatchObject({
        name: 'MoabomShellModuleApiError',
        status: 422,
        reason: 'friendship_already_exists',
      } satisfies Partial<MoabomShellModuleApiError>);
  });
});
