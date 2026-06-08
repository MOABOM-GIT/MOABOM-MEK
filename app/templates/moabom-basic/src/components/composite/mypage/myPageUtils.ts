import type { ButtonProps } from '../../basic/Button';
import type { MoabomTranslateFn } from '../../../i18n/moabomT';
import { GUEST_ENABLED_TABS, SYNTHETIC_EMAIL_SUFFIX, TABS } from './myPageConstants';
import type { MyPageTab } from './myPageTypes';

export function isSyntheticEmail(email: string): boolean {
  return email.trim().endsWith(SYNTHETIC_EMAIL_SUFFIX);
}

export function getSocialProviderLabel(provider: string | null | undefined, t: MoabomTranslateFn): string | null {
  if (!provider) return null;
  const normalized = provider.toLowerCase();
  const key = `moa_mypage.social.${normalized}`;
  const translated = t(key);
  if (translated !== key && translated.trim() !== '') {
    return translated;
  }
  return provider;
}

/**
 * 마이페이지 좌측 탭 라벨/설명 — `moa_mypage.tabs.{id}.{label|desc}` + 관리자(서버) 문자열.
 * G7Core.t가 미등록 키에 대해 빈 문자열을 돌려도 번역 누락으로 간주하고 서버값·다음 폴백으로 넘깁니다.
 */
export function resolveMypageTabField(
  t: MoabomTranslateFn,
  menuId: string,
  field: 'label' | 'desc',
  serverValue?: string | null,
): string {
  const key = `moa_mypage.tabs.${menuId}.${field}`;
  const tr = t(key);
  if (tr !== key && tr.trim() !== '') {
    return tr;
  }
  const fromServer = serverValue?.trim();
  if (fromServer) {
    return fromServer;
  }
  return tr;
}

export function flattenFieldErrors(errors?: Record<string, string[] | string>): Record<string, string> {
  if (!errors) return {};
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(errors)) {
    out[key] = Array.isArray(val) ? (val[0] ?? '') : String(val);
  }
  return out;
}

/** 코어 TemplateApp 토스트 (G7Core.toast 또는 toast 핸들러 폴백) */
export function showCoreToast(type: 'success' | 'error', message: string, duration: number): void {
  const G7Core = (window as any).G7Core;
  if (type === 'success') {
    if (G7Core?.toast?.success) {
      G7Core.toast.success(message, duration);
      return;
    }
    G7Core?.dispatch?.({ handler: 'toast', params: { type: 'success', message, duration } });
    return;
  }
  if (G7Core?.toast?.error) {
    G7Core.toast.error(message, duration);
    return;
  }
  G7Core?.dispatch?.({ handler: 'toast', params: { type: 'error', message, duration } });
}

export function normalizeTab(tab?: MyPageTab): MyPageTab {
  return TABS.some(item => item.id === tab) ? tab as MyPageTab : 'profile';
}

/** 메뉴 구조 행 (`tabStructureForRouting`) — 레이아웃 effect 단일 병합용 */
export type MyPageTabStructureRow = { id: MyPageTab; guestEnabled: boolean };

/**
 * 부모 탭(initialTab)·게스트·서버 메뉴 노출 규칙을 한 번에 병합한다.
 * 분리된 layout effect + 탭 유효성 effect가 번갈아 setState 하면 무한 루프(React #185)가 나므로 SSoT로 사용한다.
 */
export function reconcileMyPageTabFromShell(
  initialTab: MyPageTab | undefined,
  isLoggedIn: boolean,
  tabStructureForRouting: readonly MyPageTabStructureRow[],
): MyPageTab {
  const isGuest = !isLoggedIn;
  const normalized = normalizeTab(initialTab);
  let candidate: MyPageTab =
    isGuest && !isGuestEnabledTab(normalized) ? 'settings' : normalized;

  const rowVisibleForUser = (row: MyPageTabStructureRow): boolean =>
    !isGuest || row.guestEnabled;

  const isCandidateVisible =
    tabStructureForRouting.some(row => row.id === candidate && rowVisibleForUser(row));

  if (isCandidateVisible) {
    return candidate;
  }

  return (
    tabStructureForRouting.find(row => rowVisibleForUser(row))?.id ??
    ('settings' as MyPageTab)
  );
}

export function isGuestEnabledTab(tab: MyPageTab): boolean {
  return GUEST_ENABLED_TABS.includes(tab);
}

export function formatCredit(point: number, t: MoabomTranslateFn): string {
  return t('moa_mypage.credit.amount_unit', { amount: point.toLocaleString() });
}

/** appearance.theme id → `moa_mypage.themes.*` 번역 키 */
export function themeTranslationKey(themeId: string): string {
  const map: Record<string, string> = {
    light: 'moa_mypage.themes.light',
    dark: 'moa_mypage.themes.dark',
    'flat-light': 'moa_mypage.themes.flat_light',
    'flat-dark': 'moa_mypage.themes.flat_dark',
  };
  return map[themeId] ?? `moa_mypage.themes.${themeId.replace(/-/g, '_')}`;
}

export function activityFilterLabelKey(filterId: string): string {
  return `moa_mypage.activity.filter_${filterId}`;
}

export function optionButtonVariant(active: boolean): ButtonProps['variant'] {
  return active ? 'primary' : 'primary-outline';
}
