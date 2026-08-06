import { getShellAccessScopeKey, getShellAccessToken } from '../api/moabomShellAccess';
import { registerMoabomFetchHandler, resetMoabomFetchInterceptorForTest } from './moabomFetchInterceptor';

const USER_SHELL_STATE_PATH = '/api/modules/moabom-system/user/shell-state';
const USER_SHELL_STATE_SLICES = new Set([
  '/api/modules/moabom-system/user/settings',
  '/api/user/notifications/unread-count',
  '/api/modules/moabom-presence/public/summary',
  '/api/modules/moabom-presence/user/presence/settings',
]);

type UserShellState = {
  settings?: Record<string, unknown>;
  unread_count?: number;
  presence?: {
    summary?: Record<string, unknown>;
    settings?: Record<string, unknown>;
  };
};

type SharedUserShellState = {
  scopeKey: string;
  data: UserShellState | null;
  promise: Promise<UserShellState | null> | null;
  consumed: Record<string, boolean>;
};

declare global {
  interface Window {
    __MoabomUserShellState?: SharedUserShellState;
  }
}

let installed = false;

function sharedState(): SharedUserShellState {
  window.__MoabomUserShellState ??= {
    scopeKey: getShellAccessScopeKey(),
    data: null,
    promise: null,
    consumed: {},
  };
  window.__MoabomUserShellState.scopeKey ??= getShellAccessScopeKey();
  window.__MoabomUserShellState.consumed ??= {};
  return window.__MoabomUserShellState;
}

async function loadUserShellState(
  nativeFetch: typeof fetch,
  options: { criticalOnly?: boolean } = {},
): Promise<UserShellState | null> {
  const shared = sharedState();
  const scopeKey = getShellAccessScopeKey();
  if (shared.scopeKey !== scopeKey) {
    shared.scopeKey = scopeKey;
    shared.data = null;
    shared.promise = null;
    shared.consumed = {};
  }
  if (shared.data) {
    return shared.data;
  }
  if (shared.promise) {
    return shared.promise;
  }

  shared.promise = (async () => {
    const token = getShellAccessToken();
    if (!token) {
      return null;
    }
    try {
      const url = options.criticalOnly
        ? `${USER_SHELL_STATE_PATH}?scope=critical`
        : USER_SHELL_STATE_PATH;
      const response = await nativeFetch(url, {
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await response.json() as { success?: boolean; data?: UserShellState };
      if (!response.ok || payload.success === false || !payload.data) {
        return null;
      }
      if (scopeKey !== getShellAccessScopeKey()) {
        return null;
      }
      shared.data = payload.data;
      return shared.data;
    } catch {
      return null;
    }
  })();

  try {
    return await shared.promise;
  } finally {
    shared.promise = null;
  }
}

/** 인증 토큰이 있으면 통합 사용자 셸 상태를 부트와 병렬로 선로드한다. */
export function prefetchMoabomUserShellState(): Promise<UserShellState | null> {
  if (typeof window === 'undefined' || !getShellAccessToken()) {
    return Promise.resolve(null);
  }
  return loadUserShellState(window.fetch.bind(window), { criticalOnly: true });
}

function moduleResponse(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Cache-Control': 'private, no-store',
    },
  });
}

function stateSlice(pathname: string, state: UserShellState): Response | null {
  const shared = sharedState();
  if (shared.consumed[pathname]) {
    return null;
  }

  let response: Response | null;
  switch (pathname) {
    case '/api/modules/moabom-system/user/settings':
      response = state.settings ? moduleResponse(state.settings) : null;
      break;
    case '/api/user/notifications/unread-count':
      response = typeof state.unread_count === 'number'
        ? moduleResponse({ unread_count: state.unread_count })
        : null;
      break;
    case '/api/modules/moabom-presence/public/summary':
      response = state.presence?.summary ? moduleResponse(state.presence.summary) : null;
      break;
    case '/api/modules/moabom-presence/user/presence/settings':
      response = state.presence?.settings ? moduleResponse(state.presence.settings) : null;
      break;
    default:
      return null;
  }
  if (response) {
    shared.consumed[pathname] = true;
  }
  return response;
}

export function installMoabomUserShellStateFetch(): void {
  if (typeof window === 'undefined' || installed) {
    return;
  }
  installed = true;
  window.addEventListener('moabom:auth-token-changed', invalidateMoabomUserShellState);

  registerMoabomFetchHandler((ctx) => {
    if (ctx.method !== 'GET' || !ctx.url) {
      return null;
    }
    const { pathname } = ctx.url;
    if (
      ctx.url.origin !== window.location.origin
      || pathname === USER_SHELL_STATE_PATH
      || !USER_SHELL_STATE_SLICES.has(pathname)
    ) {
      return null;
    }

    // 슬라이스 후보만 async 진입. null 반환 시 인터셉터가 네이티브로 위임한다.
    return (async () => {
      const state = await loadUserShellState(ctx.native, { criticalOnly: true });
      return state ? stateSlice(pathname, state) : null;
    })();
  });
}

export function invalidateMoabomUserShellState(): void {
  if (typeof window === 'undefined') {
    return;
  }
  const shared = sharedState();
  shared.scopeKey = getShellAccessScopeKey();
  shared.data = null;
  shared.promise = null;
  shared.consumed = {};
}

export function resetMoabomUserShellStateForTest(): void {
  installed = false;
  invalidateMoabomUserShellState();
  resetMoabomFetchInterceptorForTest();
}
