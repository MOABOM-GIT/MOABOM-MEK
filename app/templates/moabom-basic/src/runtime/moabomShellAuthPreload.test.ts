import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ensureMoabomShellAuthPreloaded,
  MOABOM_SHELL_AUTH_USER_ENDPOINT,
  resetMoabomShellAuthPreloadForTest,
} from './moabomShellAuthPreload';
import {
  installMoabomShellAuthSingleFlight,
  resetMoabomShellAuthSingleFlightForTest,
} from './moabomShellAuthSingleFlight';

function jsonResponse(status: number): Response {
  return {
    status,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
    },
  } as Response;
}

function htmlResponse(status: number): Response {
  return {
    status,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null),
    },
  } as Response;
}

describe('ensureMoabomShellAuthPreloaded', () => {
  beforeEach(() => {
    resetMoabomShellAuthPreloadForTest();
    resetMoabomShellAuthSingleFlightForTest();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    resetMoabomShellAuthPreloadForTest();
    resetMoabomShellAuthSingleFlightForTest();
  });

  it('토큰 없으면 preloadAuth 를 호출하지 않고 guest 를 반환한다', async () => {
    const preloadAuth = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: () => null,
    });
    (window as { G7Core?: unknown }).G7Core = {
      AuthManager: {
        getInstance: () => ({
          isAuthenticated: () => false,
          getUser: () => null,
          preloadAuth,
          checkAuth: vi.fn(),
        }),
      },
    };

    const result = await ensureMoabomShellAuthPreloaded();

    expect(result).toBe('guest');
    expect(preloadAuth).not.toHaveBeenCalled();
  });

  it('preload 실패 후 probe 401(JSON) 이면 unauthorized 와 토큰 삭제를 한다', async () => {
    const preloadAuth = vi.fn().mockResolvedValue(false);
    const removeToken = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401));
    vi.stubGlobal('localStorage', {
      getItem: () => 'tok',
      removeItem: vi.fn(),
    });
    (window as { G7Core?: unknown }).G7Core = {
      api: { getToken: () => 'tok', removeToken },
      AuthManager: {
        getInstance: () => ({
          isAuthenticated: () => false,
          getUser: () => null,
          preloadAuth,
          checkAuth: vi.fn(),
        }),
      },
    };
    vi.stubGlobal('fetch', fetchMock);

    const result = await ensureMoabomShellAuthPreloaded();

    expect(result).toBe('unauthorized');
    expect(removeToken).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      MOABOM_SHELL_AUTH_USER_ENDPOINT,
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Accept: 'application/json',
          Authorization: 'Bearer tok',
        }),
      }),
    );
    expect(MOABOM_SHELL_AUTH_USER_ENDPOINT).toBe('/api/auth/user');
  });

  it('probe 가 SPA HTML 200 이면 status 를 무시하고 transient 로 토큰을 유지한다', async () => {
    const preloadAuth = vi.fn().mockResolvedValue(false);
    const removeToken = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(htmlResponse(200));
    vi.stubGlobal('localStorage', {
      getItem: () => 'tok',
      removeItem: vi.fn(),
    });
    (window as { G7Core?: unknown }).G7Core = {
      api: { getToken: () => 'tok', removeToken },
      AuthManager: {
        getInstance: () => ({
          isAuthenticated: () => false,
          getUser: () => null,
          preloadAuth,
          checkAuth: vi.fn(),
        }),
      },
    };
    vi.stubGlobal('fetch', fetchMock);

    const result = await ensureMoabomShellAuthPreloaded();

    expect(result).toBe('transient');
    expect(removeToken).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(MOABOM_SHELL_AUTH_USER_ENDPOINT, expect.any(Object));
  });

  it('preload 실패 후 네트워크 오류면 transient 이고 토큰을 유지한다', async () => {
    const preloadAuth = vi.fn().mockResolvedValue(false);
    const removeToken = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: () => 'tok',
      removeItem: vi.fn(),
    });
    (window as { G7Core?: unknown }).G7Core = {
      api: { getToken: () => 'tok', removeToken },
      AuthManager: {
        getInstance: () => ({
          isAuthenticated: () => false,
          getUser: () => null,
          preloadAuth,
          checkAuth: vi.fn(),
        }),
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    const result = await ensureMoabomShellAuthPreloaded();

    expect(result).toBe('transient');
    expect(removeToken).not.toHaveBeenCalled();
  });

  it('preloadAuth 가 이미 /api/auth/user 를 치면 probe 를 생략한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401));
    const removeToken = vi.fn();
    const preloadAuth = vi.fn(async () => {
      await fetch(MOABOM_SHELL_AUTH_USER_ENDPOINT, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer tok',
        },
      });
      return false;
    });
    vi.stubGlobal('localStorage', {
      getItem: () => 'tok',
      removeItem: vi.fn(),
    });
    (window as { G7Core?: unknown }).G7Core = {
      api: { getToken: () => 'tok', removeToken },
      AuthManager: {
        getInstance: () => ({
          isAuthenticated: () => false,
          getUser: () => null,
          preloadAuth,
          checkAuth: vi.fn(),
        }),
      },
    };
    vi.stubGlobal('fetch', fetchMock);

    const result = await ensureMoabomShellAuthPreloaded();

    expect(result).toBe('unauthorized');
    expect(removeToken).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ready 캐시가 있으면 두 번째 ensure 는 preloadAuth 를 다시 치지 않는다', async () => {
    const preloadAuth = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('localStorage', {
      getItem: () => 'tok',
    });
    (window as { G7Core?: unknown }).G7Core = {
      api: { getToken: () => 'tok' },
      AuthManager: {
        getInstance: () => ({
          isAuthenticated: () => false,
          getUser: () => null,
          preloadAuth,
          checkAuth: vi.fn(),
        }),
      },
    };

    await expect(ensureMoabomShellAuthPreloaded()).resolves.toBe('ready');
    await expect(ensureMoabomShellAuthPreloaded()).resolves.toBe('ready');
    expect(preloadAuth).toHaveBeenCalledTimes(1);
  });
});

describe('installMoabomShellAuthSingleFlight', () => {
  beforeEach(() => {
    resetMoabomShellAuthSingleFlightForTest();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    resetMoabomShellAuthSingleFlightForTest();
  });

  it('동시 preloadAuth 는 checkAuth 원본을 1회만 호출하고 같은 Promise 에 합류한다', async () => {
    let resolveAuth!: (value: boolean) => void;
    const originalCheckAuth = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveAuth = resolve;
        }),
    );
    const instance = {
      checkAuth: originalCheckAuth,
      preloadAuth: async (type: 'user') => originalCheckAuth(type),
    };
    (window as { G7Core?: unknown }).G7Core = {
      AuthManager: {
        getInstance: () => instance,
      },
    };

    expect(installMoabomShellAuthSingleFlight()).toBe(true);

    const wrapped = (
      window as { G7Core: { AuthManager: { getInstance: () => typeof instance } } }
    ).G7Core.AuthManager.getInstance();
    const p1 = wrapped.preloadAuth('user');
    const p2 = wrapped.preloadAuth('user');

    expect(originalCheckAuth).toHaveBeenCalledTimes(1);

    resolveAuth(true);
    await expect(Promise.all([p1, p2])).resolves.toEqual([true, true]);
  });
});
