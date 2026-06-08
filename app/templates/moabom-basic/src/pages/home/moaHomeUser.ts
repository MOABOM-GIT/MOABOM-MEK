import type { AuthWindowMode } from '../../components/composite/Moa_AuthWindowContent';
import type { AuthUserLike, MoaCurrentUser } from './moaHomeTypes';

/** 로그인 세션이 있으면 열지 않음(OAuth·대형 서비스와 동일: 게스트 전용 진입점만 차단) */
export function isGuestOnlyAuthMode(mode: AuthWindowMode): boolean {
  return mode === 'login' || mode === 'register';
}

export function buildMoaCurrentUser(
  user: AuthUserLike | null | undefined,
  nameFallback: string,
): MoaCurrentUser | null {
  if (!user) return null;

  return {
    name: user.nickname || user.name || user.email || nameFallback,
    level: user.level || 1,
    point: user.point || 0,
    avatar: user.avatar ?? null,
    is_admin: user.is_admin,
    is_super: user.is_super,
    social_provider: user.social_provider,
    language: user.language === 'ko' || user.language === 'en' ? user.language : undefined,
    memberKey:
      user.id !== undefined && user.id !== null && user.id !== ''
        ? String(user.id)
        : (user.email ?? ''),
  };
}
