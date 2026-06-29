import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../basic/Icon';
import { copyTextToClipboard } from '../../utils/copyTextToClipboard';

export interface ChatMessageMenuState {
  messageUuid: string;
  body: string;
  isOwn: boolean;
  x: number;
  y: number;
}

export interface ChatConversationMenuState {
  conversationUuid: string;
  x: number;
  y: number;
}

export interface Moa_ChatMessageContextMenuProps {
  menu: ChatMessageMenuState | null;
  copyLabel: string;
  deleteLabel: string;
  onClose: () => void;
  onDelete: (messageUuid: string) => void;
}

export interface Moa_ChatConversationContextMenuProps {
  menu: ChatConversationMenuState | null;
  deleteLabel: string;
  deleting?: boolean;
  onClose: () => void;
  onDelete: (conversationUuid: string) => void;
}

const LONG_PRESS_MS = 480;
const LONG_PRESS_MOVE_PX = 12;
const LONG_PRESS_SUPPRESS_CLICK_MS = 450;

type LongPressOrigin = { x: number; y: number };

function useDismissChatOverlayMenu(
  menu: unknown,
  closeMenu: () => void,
  menuSelector: string,
): void {
  useEffect(() => {
    if (!menu) {
      return undefined;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(menuSelector)) {
        return;
      }
      closeMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [closeMenu, menu, menuSelector]);
}

function createLongPressHandlers(
  openAt: (x: number, y: number) => void,
  longPressTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>,
  clearLongPress: () => void,
  onLongPressOpened?: () => void,
) {
  const originRef: { current: LongPressOrigin | null } = { current: null };

  const scheduleLongPress = (x: number, y: number) => {
    clearLongPress();
    originRef.current = { x, y };
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      originRef.current = null;
      onLongPressOpened?.();
      openAt(x, y);
    }, LONG_PRESS_MS);
  };

  const cancelIfMoved = (x: number, y: number) => {
    const origin = originRef.current;
    if (!origin || longPressTimerRef.current == null) {
      return;
    }
    const dx = x - origin.x;
    const dy = y - origin.y;
    if (dx * dx + dy * dy > LONG_PRESS_MOVE_PX * LONG_PRESS_MOVE_PX) {
      originRef.current = null;
      clearLongPress();
    }
  };

  return {
    onContextMenu: (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      onLongPressOpened?.();
      openAt(event.clientX, event.clientY);
    },
    onPointerDown: (event: React.PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }
      scheduleLongPress(event.clientX, event.clientY);
    },
    onPointerMove: (event: React.PointerEvent) => {
      cancelIfMoved(event.clientX, event.clientY);
    },
    onPointerUp: () => {
      originRef.current = null;
      clearLongPress();
    },
    onPointerCancel: () => {
      originRef.current = null;
      clearLongPress();
    },
  };
}

export function useChatMessageContextMenu(
  onDelete: (messageUuid: string) => void,
) {
  const [menu, setMenu] = useState<ChatMessageMenuState | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickUntilRef = useRef(0);

  const closeMenu = useCallback(() => setMenu(null), []);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current != null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const markLongPressOpened = useCallback(() => {
    suppressClickUntilRef.current = Date.now() + LONG_PRESS_SUPPRESS_CLICK_MS;
  }, []);

  const bindMessageInteractions = useCallback((
    messageUuid: string,
    body: string,
    isOwn: boolean,
  ) => createLongPressHandlers(
    (x, y) => {
      setMenu({
        messageUuid,
        body,
        isOwn,
        x,
        y,
      });
    },
    longPressTimerRef,
    clearLongPress,
    markLongPressOpened,
  ), [clearLongPress, markLongPressOpened]);

  useDismissChatOverlayMenu(menu, closeMenu, '.moa-chat-message-menu');

  const shouldSuppressFollowUpClick = useCallback(() => (
    Date.now() < suppressClickUntilRef.current
  ), []);

  const handleDelete = useCallback((messageUuid: string) => {
    closeMenu();
    onDelete(messageUuid);
  }, [closeMenu, onDelete]);

  return {
    menu,
    closeMenu,
    bindMessageInteractions,
    shouldSuppressFollowUpClick,
    handleDelete,
  };
}

export function useChatConversationContextMenu(
  onDelete: (conversationUuid: string) => void,
) {
  const [menu, setMenu] = useState<ChatConversationMenuState | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickUntilRef = useRef(0);

  const closeMenu = useCallback(() => setMenu(null), []);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current != null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const markLongPressOpened = useCallback(() => {
    suppressClickUntilRef.current = Date.now() + LONG_PRESS_SUPPRESS_CLICK_MS;
  }, []);

  const bindConversationInteractions = useCallback((conversationUuid: string) => (
    createLongPressHandlers(
      (x, y) => {
        setMenu({ conversationUuid, x, y });
      },
      longPressTimerRef,
      clearLongPress,
      markLongPressOpened,
    )
  ), [clearLongPress, markLongPressOpened]);

  useDismissChatOverlayMenu(menu, closeMenu, '.moa-chat-conversation-menu');

  const shouldSuppressFollowUpClick = useCallback(() => (
    Date.now() < suppressClickUntilRef.current
  ), []);

  const handleDelete = useCallback((conversationUuid: string) => {
    closeMenu();
    onDelete(conversationUuid);
  }, [closeMenu, onDelete]);

  return {
    menu,
    closeMenu,
    bindConversationInteractions,
    shouldSuppressFollowUpClick,
    handleDelete,
  };
}

export function Moa_ChatMessageContextMenu({
  menu,
  copyLabel,
  deleteLabel,
  onClose,
  onDelete,
}: Moa_ChatMessageContextMenuProps) {
  if (!menu || typeof document === 'undefined') {
    return null;
  }

  const left = Math.min(menu.x, window.innerWidth - 160);
  const top = Math.min(menu.y, window.innerHeight - 120);

  return createPortal(
    <div
      className="moa-chat-message-menu glass-panel"
      style={{ left, top }}
      role="menu"
    >
      <button
        type="button"
        className="moa-chat-message-menu__item"
        role="menuitem"
        onClick={() => {
          void copyTextToClipboard(menu.body);
          onClose();
        }}
      >
        <Icon name="copy" className="text-sm" aria-hidden />
        {copyLabel}
      </button>
      {menu.isOwn ? (
        <button
          type="button"
          className="moa-chat-message-menu__item moa-chat-message-menu__item--danger"
          role="menuitem"
          onClick={() => {
            onDelete(menu.messageUuid);
            onClose();
          }}
        >
          <Icon name="trash" className="text-sm" aria-hidden />
          {deleteLabel}
        </button>
      ) : null}
    </div>,
    document.body,
  );
}

export function Moa_ChatConversationContextMenu({
  menu,
  deleteLabel,
  deleting = false,
  onClose,
  onDelete,
}: Moa_ChatConversationContextMenuProps) {
  if (!menu || typeof document === 'undefined') {
    return null;
  }

  const left = Math.min(menu.x, window.innerWidth - 160);
  const top = Math.min(menu.y, window.innerHeight - 72);

  return createPortal(
    <div
      className="moa-chat-conversation-menu moa-chat-message-menu glass-panel"
      style={{ left, top }}
      role="menu"
    >
      <button
        type="button"
        className="moa-chat-message-menu__item moa-chat-message-menu__item--danger"
        role="menuitem"
        disabled={deleting}
        onClick={() => {
          onDelete(menu.conversationUuid);
          onClose();
        }}
      >
        <Icon name="trash" className="text-sm" aria-hidden />
        {deleteLabel}
      </button>
    </div>,
    document.body,
  );
}
