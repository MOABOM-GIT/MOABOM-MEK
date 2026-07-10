import { describe, expect, it } from 'vitest';
import {
  handleMoabomAppShellBridgeMessage,
  parseMoabomAppShellOpenAppMessage,
  parseMoabomAppShellToastMessage,
} from '../generatedAppIframeBridge';

describe('generatedAppIframeBridge shell allowlist', () => {
  it('parses toast and open-app messages', () => {
    expect(parseMoabomAppShellToastMessage({
      source: 'moabom-app',
      type: 'shell-toast',
      message: 'hello',
      severity: 'success',
    })).toEqual({
      source: 'moabom-app',
      type: 'shell-toast',
      message: 'hello',
      severity: 'success',
    });

    expect(parseMoabomAppShellOpenAppMessage({
      source: 'moabom-app',
      type: 'shell-open-app',
      appId: 'mypage',
    })?.appId).toBe('mypage');

    expect(parseMoabomAppShellOpenAppMessage({
      source: 'moabom-app',
      type: 'shell-open-app',
      appId: '../evil',
    })).toBeNull();
  });

  it('dispatches allowlisted handlers only', () => {
    const toasts: string[] = [];
    const opened: string[] = [];
    expect(handleMoabomAppShellBridgeMessage(
      { source: 'moabom-app', type: 'shell-toast', message: 'ok', severity: 'info' },
      { onToast: (message) => toasts.push(message), onOpenApp: (id) => opened.push(id) },
    )).toBe(true);
    expect(toasts).toEqual(['ok']);
    expect(handleMoabomAppShellBridgeMessage(
      { source: 'moabom-app', type: 'unknown-hack' },
      { onToast: (message) => toasts.push(message), onOpenApp: (id) => opened.push(id) },
    )).toBe(false);
  });
});
