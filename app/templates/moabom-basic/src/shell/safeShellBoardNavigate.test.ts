import { describe, expect, it, vi } from 'vitest';
import type { MoaShellBoardBridge } from './moaShellBoardBridge';
import { safeTryHandleBoardShellNavigate } from './safeShellBoardNavigate';
import { markMoabomShellHomeMounted } from './moaShellErrorBridge';

describe('safeTryHandleBoardShellNavigate', () => {
  it('브릿지 예외 시 false 를 반환하고 전파하지 않는다', () => {
    markMoabomShellHomeMounted(true);
    const bridge: MoaShellBoardBridge = {
      isActive: () => true,
      openBoard: vi.fn(() => {
        throw new Error('openBoard failed');
      }),
      openAuth: vi.fn(),
    };

    expect(() => safeTryHandleBoardShellNavigate('/board/notice', bridge)).not.toThrow();
    expect(safeTryHandleBoardShellNavigate('/board/notice', bridge)).toBe(false);
    markMoabomShellHomeMounted(false);
  });
});
