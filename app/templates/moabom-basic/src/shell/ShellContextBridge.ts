import { resolveClientFormFactor } from '../utils/clientFormFactor';
import { getShellAccessToken } from '../api/moabomShellAccess';

export type ShellLayoutCurrentUser = {
  uuid: string;
  name: string;
  nickname?: string | null;
  avatar?: string | null;
  is_admin?: boolean;
  is_super?: boolean;
};

export type ShellLayoutContext = {
  currentUser: ShellLayoutCurrentUser | null;
  visitorId: string;
  isAuthenticated: boolean;
  formFactor: 'desktop' | 'mobile';
};

const VISITOR_ID_STORAGE = 'moabom_visitor_id';

type AuthUserSnapshot = {
  uuid?: string;
  name?: string;
  nickname?: string | null;
  avatar?: string | null;
  is_admin?: boolean;
  is_super?: boolean;
};

function readAuthUserSnapshot(): AuthUserSnapshot | null {
  return (window as {
    G7Core?: { AuthManager?: { getInstance: () => { getUser: () => AuthUserSnapshot | null } } };
  }).G7Core?.AuthManager?.getInstance?.()?.getUser?.() ?? null;
}

function asLayoutCurrentUser(value: Record<string, unknown>): ShellLayoutCurrentUser | null {
  const uuid = typeof value.uuid === 'string' ? value.uuid.trim() : '';
  if (!uuid) {
    return null;
  }
  return {
    uuid,
    name: String(value.name ?? '').trim() || uuid,
    nickname: (value.nickname as string | null | undefined) ?? null,
    avatar: (value.avatar as string | null | undefined) ?? null,
    is_admin: value.is_admin as boolean | undefined,
    is_super: value.is_super as boolean | undefined,
  };
}

/** shell-boot·heartbeat SSOT — 구 `moabom_presence_client_key` 와 병행 호환 */
export function getOrCreateShellVisitorId(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    const existing = localStorage.getItem(VISITOR_ID_STORAGE)
      ?? localStorage.getItem('moabom_presence_client_key');
    if (existing) {
      if (!localStorage.getItem(VISITOR_ID_STORAGE)) {
        localStorage.setItem(VISITOR_ID_STORAGE, existing);
      }
      return existing;
    }
    const created = crypto.randomUUID();
    localStorage.setItem(VISITOR_ID_STORAGE, created);
    localStorage.setItem('moabom_presence_client_key', created);
    return created;
  } catch {
    return `visitor-${Date.now()}`;
  }
}

export function resolveShellLayoutContext(): ShellLayoutContext {
  const user = readAuthUserSnapshot();
  const uuid = typeof user?.uuid === 'string' ? user.uuid.trim() : '';
  const currentUser = uuid
    ? {
      uuid,
      name: String(user?.name ?? '').trim() || uuid,
      nickname: user?.nickname ?? null,
      avatar: user?.avatar ?? null,
      is_admin: user?.is_admin,
      is_super: user?.is_super,
    }
    : null;

  return {
    currentUser,
    visitorId: getOrCreateShellVisitorId(),
    isAuthenticated: currentUser != null,
    formFactor: resolveClientFormFactor(),
  };
}

/**
 * G7 layout `dataContext._global` 에 셸 인증·방문자 컨텍스트를 주입한다.
 * 게시판 비회원 폼(`!_global.currentUser?.uuid`) 등 G7 순정 분기 SSOT.
 *
 * AuthBoot: `/api/auth/user` 5xx 등으로 AuthManager 가 clear 되어도 토큰이 남아 있으면
 * prior uuid 를 유지해 guest 폼으로 떨어지지 않게 한다 (확정 401 만 토큰·user 제거).
 */
export function mergeShellContextIntoGlobalState(
  globalState: Record<string, unknown>,
): Record<string, unknown> {
  const shell = resolveShellLayoutContext();
  const prior = (typeof globalState.currentUser === 'object' && globalState.currentUser != null)
    ? globalState.currentUser as Record<string, unknown>
    : {};
  const priorUser = asLayoutCurrentUser(prior);

  let currentUser: Record<string, unknown> | null = shell.currentUser
    ? { ...prior, ...shell.currentUser }
    : null;

  // transient: AuthManager user 없음 + 토큰 유지 + prior uuid → 유지
  if (!currentUser && priorUser && getShellAccessToken()) {
    currentUser = { ...prior, ...priorUser };
  }

  return {
    ...globalState,
    currentUser,
    shell: {
      visitorId: shell.visitorId,
      isAuthenticated: currentUser != null || Boolean(getShellAccessToken()),
      formFactor: shell.formFactor,
    },
  };
}

type TemplateAppGlobalStateWriter = {
  getGlobalState?: () => Record<string, unknown>;
  setGlobalState?: (updates: Record<string, unknown>) => void;
};

/**
 * G7 layout·data source·action refetch 가 동일한 `_global.currentUser` 를 보도록
 * templateApp 전역 상태에 셸 컨텍스트를 발행한다.
 */
export function publishShellLayoutContext(
  templateApp?: TemplateAppGlobalStateWriter | null,
): Record<string, unknown> {
  const merged = mergeShellContextIntoGlobalState(templateApp?.getGlobalState?.() ?? {});
  templateApp?.setGlobalState?.({
    currentUser: merged.currentUser,
    shell: merged.shell,
  });
  return merged;
}
