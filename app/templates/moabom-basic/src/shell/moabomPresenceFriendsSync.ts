const MOABOM_PRESENCE_FRIENDS_CHANGED_EVENT = 'moabom-presence-friends-changed';

/** 친구 탭 미활성 시 REST 생략 — 탭 진입 시 1회 강제 갱신 */
let friendsListStale = false;

export function markMoabomPresenceFriendsStale(): void {
  friendsListStale = true;
}

export function consumeMoabomPresenceFriendsStale(): boolean {
  if (!friendsListStale) {
    return false;
  }
  friendsListStale = false;
  return true;
}

export function peekMoabomPresenceFriendsStale(): boolean {
  return friendsListStale;
}

export function resetMoabomPresenceFriendsStaleForTest(): void {
  friendsListStale = false;
}

export function notifyMoabomPresenceFriendsChanged(): void {
  if (typeof window === 'undefined') {
    return;
  }
  markMoabomPresenceFriendsStale();
  window.dispatchEvent(new CustomEvent(MOABOM_PRESENCE_FRIENDS_CHANGED_EVENT));
}

export function subscribeMoabomPresenceFriendsChanged(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handler = () => listener();
  window.addEventListener(MOABOM_PRESENCE_FRIENDS_CHANGED_EVENT, handler);
  return () => window.removeEventListener(MOABOM_PRESENCE_FRIENDS_CHANGED_EVENT, handler);
}
