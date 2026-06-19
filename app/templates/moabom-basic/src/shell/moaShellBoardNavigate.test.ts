import { describe, expect, it, vi } from 'vitest';
import type { MoaShellBoardBridge } from '../moaShellBoardBridge';
import {
  buildBoardNavigatePath,
  resolveShellAuthModeFromPath,
  tryHandleBoardShellNavigate,
} from '../moaShellBoardNavigate';
import { formatBoardShellPath } from '../utils/moabomShellRoutes';

describe('moaShellBoardNavigate', () => {
  it('resolveShellAuthModeFromPath 가 레거시·셸 경로를 인식한다', () => {
    expect(resolveShellAuthModeFromPath('/login')).toBe('login');
    expect(resolveShellAuthModeFromPath('/auth/register')).toBe('register');
  });

  it('formatBoardShellPath 가 쿼리를 유지한다', () => {
    expect(formatBoardShellPath('notice', undefined, '?page=2&category=free')).toBe('/board/notice?page=2&category=free');
    expect(formatBoardShellPath('notice', '9', '')).toBe('/board/notice/9');
  });

  it('buildBoardNavigatePath 가 mergeQuery 로 기존 쿼리를 병합한다', () => {
    const path = buildBoardNavigatePath(
      '/board/notice',
      {
        mergeQuery: true,
        query: { page: '2', category: 'free' },
      },
      '?category=notice&page=1',
    );
    expect(path).toContain('/board/notice');
    expect(path).toContain('page=2');
    expect(path).toContain('category=free');
  });

  it('tryHandleBoardShellNavigate 가 게시판·로그인 경로를 브릿지로 위임한다', () => {
    const openBoard = vi.fn();
    const openAuth = vi.fn();
    const bridge: MoaShellBoardBridge = {
      isActive: () => true,
      openBoard,
      openAuth,
    };

    expect(tryHandleBoardShellNavigate('/board/notice/42', bridge)).toBe(true);
    expect(openBoard).toHaveBeenCalledWith('notice', '42', expect.objectContaining({ shellPath: '/board/notice/42' }));

    expect(tryHandleBoardShellNavigate('/board/notice?page=3', bridge)).toBe(true);
    expect(openBoard).toHaveBeenLastCalledWith('notice', undefined, expect.objectContaining({ shellPath: '/board/notice?page=3' }));

    expect(tryHandleBoardShellNavigate('/board/notice/write', bridge)).toBe(true);
    expect(openBoard).toHaveBeenLastCalledWith('notice', undefined, expect.objectContaining({
      shellPath: '/board/notice/write',
      boardMode: 'write',
    }));

    expect(tryHandleBoardShellNavigate('/login', bridge)).toBe(true);
    expect(openAuth).toHaveBeenCalledWith('login');

    expect(tryHandleBoardShellNavigate('/shop', bridge)).toBe(false);
  });

  it('게시판 윈도우가 없으면 navigate 를 가로채지 않는다', () => {
    const bridge: MoaShellBoardBridge = {
      isActive: () => false,
      openBoard: vi.fn(),
      openAuth: vi.fn(),
    };
    expect(tryHandleBoardShellNavigate('/board/notice', bridge)).toBe(false);
  });
});
