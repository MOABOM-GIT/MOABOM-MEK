import type { MoabomTranslateFn } from '../../../i18n/moabomT';
import type { MoabomSystemMenuConfig } from '../../../types/moabomSystem';
import { TAB_DEFINITIONS } from './myPageConstants';
import type { MyPageTab } from './myPageTypes';
import { isGuestEnabledTab, resolveMypageTabField, type MyPageTabStructureRow } from './myPageUtils';

/** 관리자 `mypage.menus`(SortableMypageMenuList)와 동일한 행 타입 */
export type MyPageMenuRow = MoabomSystemMenuConfig;

export interface MyPageSidebarTab {
  id: MyPageTab;
  icon: string;
  label: string;
  desc: string;
  guestEnabled: boolean;
}

function isKnownMyPageTabId(id: string): id is MyPageTab {
  return TAB_DEFINITIONS.some(tab => tab.id === id);
}

/** API `mypage.menus[].id` 는 string 이지만, 활성·알려진 탭만 MyPageTab 으로 좁힌다. */
function isEnabledMyPageMenuRow(menu: MoabomSystemMenuConfig): menu is MoabomSystemMenuConfig & {
  id: MyPageTab;
} {
  return menu.enabled && isKnownMyPageTabId(menu.id);
}

function iconForMenuId(menuId: string, menuIcon?: string | null): string {
  if (menuIcon?.trim()) {
    return menuIcon;
  }
  return TAB_DEFINITIONS.find(tab => tab.id === menuId)?.icon ?? 'circle';
}

/** URL·탭 reconcile용 — enabled·order·guest_enabled만 (라벨과 무관) */
export function buildMyPageTabStructureForRouting(
  menusFromDefaults: MyPageMenuRow[] | undefined,
): MyPageTabStructureRow[] {
  const list = menusFromDefaults ?? [];
  if (list.length > 0) {
    return list
      .filter(isEnabledMyPageMenuRow)
      .sort((a, b) => a.order - b.order)
      .map(menu => ({
        id: menu.id,
        guestEnabled: menu.guest_enabled,
      }));
  }
  return TAB_DEFINITIONS.map(tab => ({
    id: tab.id,
    guestEnabled: isGuestEnabledTab(tab.id),
  }));
}

/** 사이드바 렌더용 — 서버 메뉴 문자열 + i18n 폴백 병합 */
export function buildMyPageSidebarTabs(
  t: MoabomTranslateFn,
  menusFromDefaults: MyPageMenuRow[] | undefined,
): MyPageSidebarTab[] {
  const menuSettings = menusFromDefaults ?? [];
  const fallbackTabsFromLocale: MyPageSidebarTab[] = TAB_DEFINITIONS.map(tab => ({
    id: tab.id,
    icon: tab.icon,
    label: resolveMypageTabField(t, tab.id, 'label'),
    desc: resolveMypageTabField(t, tab.id, 'desc'),
    guestEnabled: isGuestEnabledTab(tab.id),
  }));

  if (menuSettings.length === 0) {
    return fallbackTabsFromLocale;
  }

  return menuSettings
    .filter(isEnabledMyPageMenuRow)
    .sort((a, b) => a.order - b.order)
    .map(menu => ({
      id: menu.id,
      label: resolveMypageTabField(t, menu.id, 'label', menu.label),
      desc: resolveMypageTabField(t, menu.id, 'desc', menu.description),
      icon: iconForMenuId(menu.id, menu.icon),
      guestEnabled: menu.guest_enabled,
    }));
}
