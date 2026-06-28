import { describe, expect, it } from 'vitest';
import {
  areShellWindowRendererPropsEqual,
  buildShellWindowRenderFingerprint,
} from './moaShellWindowRendererCompare';
import type { Moa_ShellWindowRendererProps } from '../pages/home/Moa_ShellWindowRenderer';
import type { WindowState } from '../components/composite/Moa_CenterPanel';

const baseWin: WindowState = {
  id: 'w1',
  appId: 'hospital-info',
  title: 't',
  icon: 'hospital',
  gradient: 'g',
  zIndex: 1,
  isMaximized: false,
  isMinimized: false,
  initialX: 0,
  initialY: 0,
};

function baseProps(overrides: Partial<Moa_ShellWindowRendererProps> = {}): Moa_ShellWindowRendererProps {
  return {
    win: baseWin,
    t: (k: string) => k,
    compactWindow: false,
    authStateKey: '',
    currentUser: null,
    createdApps: [],
    favoriteApps: [],
    recentApps: [],
    resolveWinTitle: w => w.title,
    onOpenApp: () => {},
    onEditGeneratedApp: () => {},
    onDeleteGeneratedApp: () => {},
    onToggleGeneratedAppShare: async () => {},
    onOpenAuthWindow: () => {},
    onAuthenticated: () => {},
    onProfileUpdated: () => {},
    onMyPageTabChange: () => {},
    onOpenBoard: () => {},
    onLegalPageTitleResolved: () => {},
    onBoardWindowTitleResolved: () => {},
    onGeneratedAppWindowTitleResolved: () => {},
    onUserProfileWindowTitleResolved: () => {},
    onUserProfileViewChange: () => {},
    onErrorWindowTitleResolved: () => {},
    ...overrides,
  };
}

describe('moaShellWindowRendererCompare', () => {
  it('fingerprint — zIndex 변경은 콘텐츠 fingerprint에 포함하지 않음', () => {
    const a = buildShellWindowRenderFingerprint(baseWin);
    const b = buildShellWindowRenderFingerprint({ ...baseWin, zIndex: 99 });
    expect(a).toBe(b);
  });

  it('authStateKey 변경 시 비마이페이지 창만 리렌더', () => {
    const prev = baseProps({ authStateKey: '' });
    const next = baseProps({ authStateKey: '7' });
    expect(areShellWindowRendererPropsEqual(prev, next)).toBe(false);
  });

  it('auth 무관 창 — currentUser 변경만으로는 equal', () => {
    const prev = baseProps({ authStateKey: '7', currentUser: null });
    const next = baseProps({
      authStateKey: '7',
      currentUser: { name: 'u', level: 1, point: 0, memberKey: '7' },
    });
    expect(areShellWindowRendererPropsEqual(prev, next)).toBe(true);
  });
});
