import {
  isEcommerceMypageSubpath,
  normalizePathname,
  pathNeedsLegacyG7RouterPath,
} from './moabomLegacyMypagePaths';
import { navigateMoabomChatNotification } from './moabomChatNotificationNavigate';
import { invalidateBoardShellCacheForNavigate } from '../shell/invalidateBoardShellCacheForNavigate';
import { navigateMoabomShellPath } from '../shell/navigateMoabomShellPath';

const MY_PAGE_TABS = [
  'profile',
  'settings',
  'credit',
  'library',
  'activity',
  'account',
  'subscription',
] as const;

type MyPageTab = (typeof MY_PAGE_TABS)[number];

function isMyPageTab(value: string): value is MyPageTab {
  return (MY_PAGE_TABS as readonly string[]).includes(value);
}

/** 절대·상대 URL에서 pathname+search+hash 추출 (동일 origin) */
export function extractNotificationPath(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (typeof window !== 'undefined' && parsed.origin !== window.location.origin) {
        return trimmed;
      }
      const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      return path || '/';
    } catch {
      return trimmed;
    }
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function mapLegacyMypagePath(pathname: string): string | null {
  const base = normalizePathname(pathname);
  const parts = base.split('/').filter(Boolean);
  if (parts[0] !== 'mypage') {
    return null;
  }

  if (parts.length === 1) {
    return '/me/profile';
  }

  const segment = decodeURIComponent(parts[1]);
  if (segment === 'change-password') {
    return '/me/account';
  }
  if (isMyPageTab(segment)) {
    return `/me/${segment}`;
  }
  if (isEcommerceMypageSubpath(base)) {
    return null;
  }

  return '/me/profile';
}

function isWelcomeNotificationType(notificationType?: string | null): boolean {
  return (notificationType ?? '').trim() === 'welcome';
}

function isLoginLikeNotificationPath(pathname: string): boolean {
  const base = normalizePathname(pathname);
  return base === '/login'
    || base === '/auth/login'
    || base === '/register'
    || base === '/auth/register';
}

/** 알림 type 기반 fallback (click_url 없거나 레거시 `/mypage`만 있을 때) */
export function resolveNotificationFallbackPath(notificationType?: string | null): string {
  const type = (notificationType ?? '').trim();
  if (!type) {
    return '/me/profile';
  }

  if (type === 'welcome') {
    return '/me/account';
  }

  if (type === 'password_changed') {
    return '/me/account';
  }

  if (
    type.startsWith('board.') ||
    type.includes('comment') ||
    type.includes('post') ||
    type.includes('report')
  ) {
    return '/me/activity';
  }

  if (type.startsWith('ecommerce.') || type.includes('order') || type.includes('inquiry')) {
    return '/me/profile';
  }

  return '/me/profile';
}

/**
 * 알림 클릭 시 이동할 Moabom 셸/G7 호환 경로.
 * - `/mypage` → `/me/profile` 등 레거시 정규화
 * - 이커머스 `/mypage/orders/...` 는 경로 유지 (router 병합)
 */
export function resolveNotificationNavigatePath(
  url: string | null | undefined,
  notificationType?: string | null,
): string | null {
  if (isWelcomeNotificationType(notificationType)) {
    return '/me/account';
  }

  const raw = extractNotificationPath(url);
  if (!raw) {
    return resolveNotificationFallbackPath(notificationType);
  }

  if (/^https?:\/\//i.test(raw)) {
    if (isWelcomeNotificationType(notificationType)) {
      try {
        const parsed = new URL(raw);
        if (
          typeof window !== 'undefined'
          && parsed.origin === window.location.origin
          && isLoginLikeNotificationPath(parsed.pathname)
        ) {
          return '/me/account';
        }
      } catch {
        // fall through
      }
    }
    return raw;
  }

  const pathname = normalizePathname(raw.split(/[?#]/)[0] ?? raw);
  const suffix = raw.slice(pathname.length);

  if (isWelcomeNotificationType(notificationType) && isLoginLikeNotificationPath(pathname)) {
    return '/me/account';
  }

  const mapped = mapLegacyMypagePath(pathname);
  if (mapped) {
    return mapped;
  }

  if (
    pathname.startsWith('/me/') ||
    pathname === '/me' ||
    pathname.startsWith('/board/') ||
    pathname.startsWith('/app/') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/users/') ||
    pathNeedsLegacyG7RouterPath(pathname)
  ) {
    return `${pathname}${suffix}`;
  }

  if (pathname === '/mypage' || pathname.startsWith('/mypage/')) {
    return resolveNotificationFallbackPath(notificationType);
  }

  return `${pathname}${suffix}`;
}

export function navigateMoabomNotificationUrl(
  url: string | null | undefined,
  notificationType?: string | null,
  notificationData?: Record<string, unknown> | null,
): void {
  if (
    navigateMoabomChatNotification({
      type: notificationType ?? '',
      url: url ?? null,
      data: notificationData,
    })
  ) {
    return;
  }

  const target = resolveNotificationNavigatePath(url, notificationType);
  if (!target) {
    return;
  }

  if (/^https?:\/\//i.test(target)) {
    window.location.href = target;
    return;
  }

  if (target.startsWith('/admin')) {
    window.location.href = target;
    return;
  }

  const pathname = normalizePathname(target.split(/[?#]/)[0] ?? target);
  const search = target.includes('?') ? target.slice(target.indexOf('?')) : '';
  const shellPath = `${pathname}${search}`;
  invalidateBoardShellCacheForNavigate(shellPath, notificationType, notificationData);
  if (navigateMoabomShellPath(shellPath)) {
    return;
  }

  const G7Core = (window as { G7Core?: { dispatch?: (action: unknown) => void } }).G7Core;
  if (G7Core?.dispatch) {
    G7Core.dispatch({ handler: 'navigate', params: { path: target } });
    return;
  }

  window.location.href = target;
}
