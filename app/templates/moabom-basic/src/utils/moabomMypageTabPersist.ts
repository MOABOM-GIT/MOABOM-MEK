import type { MyPageTab } from '../components/composite/mypage/myPageTypes';
import { MY_PAGE_TABS } from './moabomMypageTabIds';

const SESSION_KEY = 'moabom_mypage_active_tab';

function isMyPageTab(value: string): value is MyPageTab {
  return (MY_PAGE_TABS as readonly string[]).includes(value);
}

export function persistMyPageActiveTab(tab: MyPageTab): void {
  try {
    sessionStorage.setItem(SESSION_KEY, tab);
  } catch {
    // ignore
  }
}

export function readPersistedMyPageActiveTab(): MyPageTab | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw && isMyPageTab(raw)) {
      return raw;
    }
  } catch {
    // ignore
  }
  return null;
}

export function clearPersistedMyPageActiveTab(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
