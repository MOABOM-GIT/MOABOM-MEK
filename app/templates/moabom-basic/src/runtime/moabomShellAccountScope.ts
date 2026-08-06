import { invalidatePresenceSettingsCache } from '../api/moabomPresenceApi';
import { invalidateShellUserRankingsCache } from '../api/moabomShellRankingsApi';
import { getShellAccessScopeKey } from '../api/moabomShellAccess';
import { invalidateMoabomSystemSettingsCache } from '../api/moabomSystemApi';
import { clearAppCommunitySessionCache } from '../apps/app-community/appCommunitySessionCache';
import { clearMoabomActivityLevelCache } from '../hooks/useMoabomActivityLevel';
import { clearMoabomShellActiveChat } from './moabomShellActiveChat';
import { clearChatAutoStartGuards } from './moabomShellChatAutoStartGuard';
import { clearConversationLeftState } from './moabomShellChatLeftConversations';
import { invalidateMoabomGeneratedAppLibraryCache } from './moabomGeneratedAppLibraryLoad';
import { invalidateMoabomShellAuthPreload } from './moabomShellAuthPreload';
import { clearMoabomShellPendingChatNavigation } from './moabomShellPendingChatNavigation';
import { invalidateMoabomUserShellState } from './moabomUserShellState';
import { clearShellChatInboxCache } from '../shell/moabomShellChatInboxCache';
import { setShellNotificationCache } from '../shell/moabomShellNotificationBridge';
import { clearShellUnreadBadge } from '../shell/moabomShellUnreadBadge';
import {
  clearUserProfilePayloadCache,
  invalidateUserProfileShellBindingCache,
} from '../shell/userProfileWindowPrefetch';

let activeScopeKey = getShellAccessScopeKey();
let installed = false;

function clearAccountBoundState(): void {
  clearShellChatInboxCache();
  setShellNotificationCache([]);
  clearShellUnreadBadge();
  clearMoabomShellActiveChat();
  clearMoabomShellPendingChatNavigation();
  clearConversationLeftState();
  clearChatAutoStartGuards();
  clearMoabomActivityLevelCache();
  invalidateShellUserRankingsCache();
  clearAppCommunitySessionCache();
  clearUserProfilePayloadCache();
  invalidateUserProfileShellBindingCache();
  invalidatePresenceSettingsCache();
  invalidateMoabomSystemSettingsCache();
  invalidateMoabomGeneratedAppLibraryCache();
  invalidateMoabomShellAuthPreload();
  invalidateMoabomUserShellState();
}

/**
 * 토큰 원문이 바뀐 순간을 계정 상태의 원자적 경계로 취급한다.
 * 각 surface가 개별 passive effect로 늦게 정리하기 전에 module cache를 먼저 폐기한다.
 */
export function syncMoabomShellAccountScope(): boolean {
  const nextScopeKey = getShellAccessScopeKey();
  if (nextScopeKey === activeScopeKey) {
    return false;
  }

  activeScopeKey = nextScopeKey;
  clearAccountBoundState();
  return true;
}

export function installMoabomShellAccountScopeBoundary(): () => void {
  if (installed || typeof window === 'undefined') {
    return () => {};
  }
  installed = true;
  activeScopeKey = getShellAccessScopeKey();

  const onAuthTokenChanged = () => {
    syncMoabomShellAccountScope();
  };
  window.addEventListener('moabom:auth-token-changed', onAuthTokenChanged);

  return () => {
    installed = false;
    window.removeEventListener('moabom:auth-token-changed', onAuthTokenChanged);
  };
}

export function resetMoabomShellAccountScopeForTest(): void {
  installed = false;
  activeScopeKey = getShellAccessScopeKey();
  clearAccountBoundState();
}
