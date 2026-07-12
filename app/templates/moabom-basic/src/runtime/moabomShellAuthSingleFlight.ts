/**
 * AuthManager.preloadAuth single-flight — TemplateApp·Moabom 부트·훅이
 * 동일 type 에 대해 /api/auth/user 를 한 번만 치도록 합류한다.
 *
 * checkAuth 는 래핑하지 않는다. AuthManager 가 401 refresh 후 this.checkAuth 를
 * 재귀 호출하므로, checkAuth 를 in-flight 에 합류시키면 데드락이 난다.
 * preloadAuth 본문은 checkAuth 와 동일하므로 원본 checkAuth 로 위임한다.
 */

type AuthType = 'user' | 'admin';

type AuthManagerInstance = {
  checkAuth: (type: AuthType) => Promise<boolean>;
  preloadAuth: (type: AuthType) => Promise<boolean>;
  __moabomAuthSingleFlight?: boolean;
};

type AuthManagerCtor = {
  getInstance: () => AuthManagerInstance;
};

const inFlight = new Map<AuthType, Promise<boolean>>();

let installed = false;

function wrapAuthManagerInstance(instance: AuthManagerInstance): void {
  if (instance.__moabomAuthSingleFlight) {
    return;
  }
  instance.__moabomAuthSingleFlight = true;

  const originalCheckAuth = instance.checkAuth.bind(instance);

  instance.preloadAuth = (type: AuthType): Promise<boolean> => {
    const existing = inFlight.get(type);
    if (existing) {
      return existing;
    }

    const promise = originalCheckAuth(type).finally(() => {
      inFlight.delete(type);
    });
    inFlight.set(type, promise);
    return promise;
  };
}

/**
 * `initTemplate` 초기에 1회 호출 — G7 AuthManager.getInstance 결과를 래핑.
 * AuthManager 가 아직 없으면 no-op (이후 ensure/boot 가 재시도 설치).
 */
export function installMoabomShellAuthSingleFlight(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const AuthManager = (window as { G7Core?: { AuthManager?: AuthManagerCtor } }).G7Core
    ?.AuthManager;
  if (!AuthManager?.getInstance) {
    return false;
  }

  if (!installed) {
    const originalGetInstance = AuthManager.getInstance.bind(AuthManager);
    AuthManager.getInstance = (): AuthManagerInstance => {
      const instance = originalGetInstance();
      wrapAuthManagerInstance(instance);
      return instance;
    };
    installed = true;
  }

  try {
    wrapAuthManagerInstance(AuthManager.getInstance());
  } catch {
    return false;
  }

  return true;
}

/** Vitest 격리 */
export function resetMoabomShellAuthSingleFlightForTest(): void {
  installed = false;
  inFlight.clear();
}
