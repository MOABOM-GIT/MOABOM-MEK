import { DndContext } from '@dnd-kit/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MoabomUiI18nTestProvider } from '../../i18n/moabomShellTestI18n';
import { RightPanel } from './Moa_RightPanel';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderRightPanel(currentUser: { name: string; level: number; point: number; is_admin?: boolean }) {
  render(
    <MoabomUiI18nTestProvider>
      <DndContext>
        <RightPanel
          width={280}
          rightOffset={0}
          isLoggedIn
          currentUser={currentUser}
        />
      </DndContext>
    </MoabomUiI18nTestProvider>,
  );
}

describe('RightPanel 관리자 버튼', () => {
  it('관리자 권한 사용자에게 관리자 모드 버튼을 표시한다', () => {
    renderRightPanel({ name: '관리자', level: 10, point: 0, is_admin: true });

    expect(screen.getByRole('button', { name: /관리자 모드/ })).toBeInTheDocument();
  });

  it('일반 사용자에게 관리자 모드 버튼을 표시하지 않는다', () => {
    renderRightPanel({ name: '사용자', level: 1, point: 0, is_admin: false });

    expect(screen.queryByRole('button', { name: /관리자 모드/ })).not.toBeInTheDocument();
  });

  it('관리자 모드 버튼 클릭 시 /admin으로 이동한다', () => {
    const dispatch = vi.fn();
    vi.stubGlobal('G7Core', { dispatch });
    renderRightPanel({ name: '관리자', level: 10, point: 0, is_admin: true });

    fireEvent.click(screen.getByRole('button', { name: /관리자 모드/ }));

    expect(dispatch).toHaveBeenCalledWith({ handler: 'navigate', params: { path: '/admin' } });
  });
});
