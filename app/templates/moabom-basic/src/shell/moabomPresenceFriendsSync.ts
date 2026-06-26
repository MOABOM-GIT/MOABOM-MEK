const MOABOM_PRESENCE_FRIENDS_CHANGED_EVENT = 'moabom-presence-friends-changed';

export function notifyMoabomPresenceFriendsChanged(): void {
  if (typeof window === 'undefined') {
    return;
  }
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
