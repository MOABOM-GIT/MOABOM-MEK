import { useSyncExternalStore } from 'react';
import { buildMoaCurrentUser, type AuthUserLike } from './moaShellTypes';

type AuthManagerSnapshot = {
  isAuthenticated: () => boolean;
  getUser: () => AuthUserLike | null;
  on: (event: string, handler: (...args: unknown[]) => void) => (() => void) | void;
};

function getAuthManager(): AuthManagerSnapshot | null {
  const manager = (window as { G7Core?: { AuthManager?: { getInstance: () => AuthManagerSnapshot } } })
    .G7Core?.AuthManager?.getInstance?.();
  return manager ?? null;
}

/** 게시판·프로필·앱 리뷰 등 권한 캐시 키 — 로그인 시 member id, 비로그인 시 빈 문자열 */
export function buildShellAuthStateKey(memberKey?: string | null): string {
  return memberKey?.trim() || '';
}

export function resolveShellAuthStateKeyFromWindow(): string {
  const authManager = getAuthManager();
  if (!authManager?.isAuthenticated?.() || !authManager.getUser?.()) {
    return '';
  }

  const user = buildMoaCurrentUser(authManager.getUser(), '');
  return buildShellAuthStateKey(user?.memberKey);
}

type ShellAuthStateListener = () => void;

let cachedAuthStateKey = resolveShellAuthStateKeyFromWindow();
const authStateListeners = new Set<ShellAuthStateListener>();
let authBridgeInstalled = false;
let authBridgeTeardown: (() => void) | null = null;

function getShellAuthStateSnapshot(): string {
  return cachedAuthStateKey;
}

function subscribeShellAuthState(listener: ShellAuthStateListener): () => void {
  authStateListeners.add(listener);
  return () => {
    authStateListeners.delete(listener);
  };
}

function publishShellAuthStateKey(next: string): void {
  const normalized = next.trim();
  if (normalized === cachedAuthStateKey) {
    return;
  }
  cachedAuthStateKey = normalized;
  authStateListeners.forEach(listener => listener());
}

/** React 셸 `applyAuthState` 와 G7 `authStateChange` SSOT 동기화 */
export function syncShellAuthStateKey(memberKey?: string | null): void {
  publishShellAuthStateKey(buildShellAuthStateKey(memberKey));
}

function syncShellAuthStateKeyFromWindow(): void {
  publishShellAuthStateKey(resolveShellAuthStateKeyFromWindow());
}

/**
 * G7 AuthManager `authStateChange` — 모듈 단일 리스너.
 * `useMoabomShellAuth` 부트 시 1회 설치한다.
 */
export function installShellAuthStateKeyBridge(): () => void {
  if (authBridgeInstalled) {
    return authBridgeTeardown ?? (() => {});
  }

  authBridgeInstalled = true;
  const authManager = getAuthManager();
  if (!authManager?.on) {
    return () => {
      authBridgeInstalled = false;
      authBridgeTeardown = null;
    };
  }

  const handler = () => syncShellAuthStateKeyFromWindow();
  handler();
  const off = authManager.on('authStateChange', handler);
  authBridgeTeardown = () => {
    authBridgeInstalled = false;
    authBridgeTeardown = null;
    if (typeof off === 'function') {
      off();
    }
  };

  return authBridgeTeardown;
}

/**
 * G7 AuthManager `authStateChange` → React 의존성 키.
 * `useSyncExternalStore` 단일 스토어 — 창마다 별도 `useEffect` 구독 없음.
 */
export function useShellAuthStateKey(): string {
  return useSyncExternalStore(subscribeShellAuthState, getShellAuthStateSnapshot, getShellAuthStateSnapshot);
}

export function isShellAuthMember(authStateKey: string): boolean {
  return authStateKey.length > 0;
}

/** 테스트·HMR 초기화 */
export function resetShellAuthStateKeyForTest(next = ''): void {
  cachedAuthStateKey = next;
  authStateListeners.clear();
  authBridgeInstalled = false;
  if (authBridgeTeardown) {
    authBridgeTeardown();
  }
}
