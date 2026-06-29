import { useCallback, useEffect, useRef, useState } from 'react';
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

export interface Moa_ChatMessageContextMenuProps {
  menu: ChatMessageMenuState | null;
  copyLabel: string;
  deleteLabel: string;
  onClose: () => void;
  onDelete: (messageUuid: string) => void;
}

const LONG_PRESS_MS = 480;

export function useChatMessageContextMenu(
  onDelete: (messageUuid: string) => void,
) {
  const [menu, setMenu] = useState<ChatMessageMenuState | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeMenu = useCallback(() => setMenu(null), []);

  const openMenu = useCallback((next: ChatMessageMenuState) => {
    setMenu(next);
  }, []);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current != null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const bindMessageInteractions = useCallback((
    messageUuid: string,
    body: string,
    isOwn: boolean,
  ) => ({
    onContextMenu: (event: React.MouseEvent) => {
      event.preventDefault();
      openMenu({
        messageUuid,
        body,
        isOwn,
        x: event.clientX,
        y: event.clientY,
      });
    },
    onTouchStart: (event: React.TouchEvent) => {
      clearLongPress();
      const touch = event.touches[0];
      if (!touch) {
        return;
      }
      longPressTimerRef.current = setTimeout(() => {
        openMenu({
          messageUuid,
          body,
          isOwn,
          x: touch.clientX,
          y: touch.clientY,
        });
      }, LONG_PRESS_MS);
    },
    onTouchEnd: clearLongPress,
    onTouchMove: clearLongPress,
    onTouchCancel: clearLongPress,
  }), [clearLongPress, openMenu]);

  useEffect(() => {
    if (!menu) {
      return undefined;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.moa-chat-message-menu')) {
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
  }, [closeMenu, menu]);

  return {
    menu,
    closeMenu,
    bindMessageInteractions,
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
          onClick={() => onDelete(menu.messageUuid)}
        >
          <Icon name="trash" className="text-sm" aria-hidden />
          {deleteLabel}
        </button>
      ) : null}
    </div>,
    document.body,
  );
}
