export const MOABOM_SHELL_CHAT_BLOCK_EVENT = 'moabom-shell-chat-block-changed';

export type ChatBlockChangeDetail = {
  userUuid: string;
  blocked: boolean;
};

export function notifyMoabomShellChatBlockChanged(userUuid: string, blocked: boolean): void {
  const normalized = userUuid.trim();
  if (!normalized || typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent<ChatBlockChangeDetail>(MOABOM_SHELL_CHAT_BLOCK_EVENT, {
    detail: { userUuid: normalized, blocked },
  }));
}

export function subscribeMoabomShellChatBlockChanged(
  listener: (detail: ChatBlockChangeDetail) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<ChatBlockChangeDetail>).detail;
    if (detail?.userUuid) {
      listener(detail);
    }
  };
  window.addEventListener(MOABOM_SHELL_CHAT_BLOCK_EVENT, handler);
  return () => window.removeEventListener(MOABOM_SHELL_CHAT_BLOCK_EVENT, handler);
}
