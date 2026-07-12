import type { AuthWindowMode } from '../components/composite/Moa_AuthWindowContent';

/** URL 동기화 생략 (브라우저 경로가 이미 목표와 같을 때, popstate 복원 등) */
export type ShellUrlSync = {
  skipUrl?: boolean;
  /** 게시판 윈도우 — pathname+search 전체 (쿼리 유지) */
  shellPath?: string;
  replace?: boolean;
};

export type ResponsiveMode = 'desktop' | 'right-overlay' | 'mobile-overlay';

export interface HomePageProps {
  initialWindow?: AuthWindowMode;
}

export interface MoaCurrentUser {
  /** G7 `/api/auth/user` · 게시판 `!_global.currentUser?.uuid` 분기 SSOT */
  uuid?: string;
  name: string;
  level: number;
  point: number;
  avatar?: string | null;
  is_admin?: boolean;
  is_super?: boolean;
  social_provider?: string | null;
  language?: 'ko' | 'en' | null;
  memberKey?: string;
}

export interface AuthUserLike {
  uuid?: string;
  id?: number | string;
  name?: string;
  nickname?: string;
  email?: string;
  avatar?: string | null;
  level?: number;
  point?: number;
  is_admin?: boolean;
  is_super?: boolean;
  social_provider?: string | null;
  language?: string | null;
}

/** 로그인 세션이 있으면 열지 않음(OAuth·대형 서비스와 동일: 게스트 전용 진입점만 차단) */
export function isGuestOnlyAuthMode(mode: AuthWindowMode): boolean {
  return mode === 'login' || mode === 'register';
}

export function buildMoaCurrentUser(
  user: AuthUserLike | null | undefined,
  nameFallback: string,
): MoaCurrentUser | null {
  if (!user) return null;

  const uuid = typeof user.uuid === 'string' ? user.uuid.trim() : '';
  const idKey =
    user.id !== undefined && user.id !== null && user.id !== ''
      ? String(user.id)
      : '';

  return {
    uuid: uuid || undefined,
    name: user.nickname || user.name || user.email || nameFallback,
    level: user.level || 1,
    point: user.point || 0,
    avatar: user.avatar ?? null,
    is_admin: user.is_admin,
    is_super: user.is_super,
    social_provider: user.social_provider,
    language: user.language === 'ko' || user.language === 'en' ? user.language : undefined,
    memberKey: uuid || idKey || (user.email ?? ''),
  };
}
