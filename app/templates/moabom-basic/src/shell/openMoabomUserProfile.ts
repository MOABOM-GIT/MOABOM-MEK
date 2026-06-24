import { getMoaShellBoardBridge } from './moaShellBoardBridge';
import type { UserProfileWindowView } from './userProfileWindowLayoutRuntime';

export function openMoabomUserProfile(
  userUuid: string,
  view: UserProfileWindowView = 'profile',
): void {
  const normalized = userUuid.trim();
  if (!normalized) {
    return;
  }
  getMoaShellBoardBridge()?.openUserProfile?.(normalized, view);
}
