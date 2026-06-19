import { DndContext } from '@dnd-kit/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MoabomUiI18nTestProvider } from '../../i18n/moabomShellTestI18n';
import { createAppShellMetadata } from '../../apps/ai-generator';
import { CenterPanel } from './Moa_CenterPanel';
import type { App } from '../../data/Moa_apps';

const apps: App[] = [
  createAppShellMetadata,
  {
    id: 'test-app',
    name: '테스트 앱',
    description: '테스트 설명',
    icon: 'star',
    gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    category: 'basic',
    source: 'system',
  },
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches: query === '(width <= 768px)',
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
});

const appsById = new Map(apps.map(a => [a.id, a]));

function renderCenterPanel() {
  render(
    <MoabomUiI18nTestProvider>
      <DndContext>
        <CenterPanel
          centerLeft={0}
          centerRight={0}
          leftOpen={false}
          rightOpen={false}
          onToggleLeft={vi.fn()}
          onToggleRight={vi.fn()}
          modeIdx={0}
          onModeChange={vi.fn()}
          filteredApps={apps}
          onOpenApp={vi.fn()}
          minimizedWindows={[]}
          onFocusWindow={vi.fn()}
          appsById={appsById}
          authWindowAppIds={[]}
          onOpenMyPageSettings={vi.fn()}
        />
      </DndContext>
    </MoabomUiI18nTestProvider>,
  );

  return {
    grid: screen.getByTestId('moa-center-grid'),
    footer: screen.getByTestId('moa-center-footer'),
  };
}

describe('CenterPanel', () => {
  it('초기 렌더링 시 모바일 하단 푸터가 표시 상태이다', () => {
    const { footer } = renderCenterPanel();

    expect(footer).not.toHaveClass('is-hidden');
  });

  it('푸터 이용약관·개인정보 버튼 클릭 시 해당 슬러그로 콜백을 호출한다', () => {
    const onOpenLegalPage = vi.fn();
    render(
      <MoabomUiI18nTestProvider>
        <DndContext>
          <CenterPanel
            centerLeft={0}
            centerRight={0}
            leftOpen={false}
            rightOpen={false}
            onToggleLeft={vi.fn()}
            onToggleRight={vi.fn()}
            modeIdx={0}
            onModeChange={vi.fn()}
            filteredApps={apps}
            onOpenApp={vi.fn()}
            minimizedWindows={[]}
            onFocusWindow={vi.fn()}
            appsById={appsById}
            authWindowAppIds={[]}
            onOpenMyPageSettings={vi.fn()}
            onOpenLegalPage={onOpenLegalPage}
          />
        </DndContext>
      </MoabomUiI18nTestProvider>,
    );

    fireEvent.click(screen.getByTestId('moa-center-footer-terms'));
    fireEvent.click(screen.getByTestId('moa-center-footer-privacy'));
    expect(onOpenLegalPage).toHaveBeenNthCalledWith(1, 'terms');
    expect(onOpenLegalPage).toHaveBeenNthCalledWith(2, 'privacy');

    cleanup();
  });

  it('푸터의 지구본 버튼 클릭 시 환경설정 열기 콜백을 호출한다', () => {
    const onOpenMyPageSettings = vi.fn();
    render(
      <MoabomUiI18nTestProvider>
        <DndContext>
          <CenterPanel
            centerLeft={0}
            centerRight={0}
            leftOpen={false}
            rightOpen={false}
            onToggleLeft={vi.fn()}
            onToggleRight={vi.fn()}
            modeIdx={0}
            onModeChange={vi.fn()}
            filteredApps={apps}
            onOpenApp={vi.fn()}
            minimizedWindows={[]}
            onFocusWindow={vi.fn()}
            appsById={appsById}
            authWindowAppIds={[]}
            onOpenMyPageSettings={onOpenMyPageSettings}
          />
        </DndContext>
      </MoabomUiI18nTestProvider>,
    );

    fireEvent.click(screen.getByTestId('moa-center-footer-locale'));
    expect(onOpenMyPageSettings).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it('앱 그리드를 아래로 스크롤하면 푸터를 숨기고 위로 스크롤하면 다시 표시한다', async () => {
    const { grid, footer } = renderCenterPanel();

    Object.defineProperty(grid, 'scrollHeight', { configurable: true, value: 1200 });
    Object.defineProperty(grid, 'clientHeight', { configurable: true, value: 600 });

    grid.scrollTop = 80;
    fireEvent.scroll(grid);

    await waitFor(() => {
      expect(footer).toHaveClass('is-hidden');
    });

    await new Promise(resolve => setTimeout(resolve, 350));

    grid.scrollTop = 20;
    fireEvent.scroll(grid);

    await waitFor(() => {
      expect(footer).not.toHaveClass('is-hidden');
    });
  });

  it('스크롤 여유가 없으면 푸터를 숨기지 않는다', () => {
    const { grid, footer } = renderCenterPanel();

    Object.defineProperty(grid, 'scrollHeight', { configurable: true, value: 500 });
    Object.defineProperty(grid, 'clientHeight', { configurable: true, value: 490 });

    grid.scrollTop = 80;
    fireEvent.scroll(grid);

    expect(footer).not.toHaveClass('is-hidden');
  });

  it('작은 스크롤 흔들림만으로는 푸터 표시 상태를 바꾸지 않는다', () => {
    const { grid, footer } = renderCenterPanel();

    Object.defineProperty(grid, 'scrollHeight', { configurable: true, value: 1200 });
    Object.defineProperty(grid, 'clientHeight', { configurable: true, value: 600 });

    grid.scrollTop = 10;
    fireEvent.scroll(grid);
    grid.scrollTop = 18;
    fireEvent.scroll(grid);
    grid.scrollTop = 12;
    fireEvent.scroll(grid);

    expect(footer).not.toHaveClass('is-hidden');
  });

  it('AI 앱 만들기 타일 클릭 시 create-app 셸 메타로 앱 열기를 호출한다', () => {
    const onOpenApp = vi.fn();
    render(
      <MoabomUiI18nTestProvider>
        <DndContext>
          <CenterPanel
            centerLeft={0}
            centerRight={0}
            leftOpen={false}
            rightOpen={false}
            onToggleLeft={vi.fn()}
            onToggleRight={vi.fn()}
            modeIdx={0}
            onModeChange={vi.fn()}
            filteredApps={apps}
            onOpenApp={onOpenApp}
            minimizedWindows={[]}
            onFocusWindow={vi.fn()}
            appsById={appsById}
            authWindowAppIds={[]}
            onOpenMyPageSettings={vi.fn()}
          />
        </DndContext>
      </MoabomUiI18nTestProvider>,
    );

    fireEvent.click(screen.getByTestId('moa-shell-create-app'));
    expect(onOpenApp).toHaveBeenCalledTimes(1);
    expect(onOpenApp).toHaveBeenCalledWith(createAppShellMetadata);

    cleanup();
  });

  it('편집 모드에서는 AI 앱 만들기 타일 클릭으로 앱 열기를 호출하지 않는다', () => {
    const onOpenApp = vi.fn();
    render(
      <MoabomUiI18nTestProvider>
        <DndContext>
          <CenterPanel
            centerLeft={0}
            centerRight={0}
            leftOpen={false}
            rightOpen={false}
            onToggleLeft={vi.fn()}
            onToggleRight={vi.fn()}
            modeIdx={0}
            onModeChange={vi.fn()}
            filteredApps={apps}
            onOpenApp={onOpenApp}
            minimizedWindows={[]}
            onFocusWindow={vi.fn()}
            editMode
            onEnterEditMode={vi.fn()}
            onExitEditMode={vi.fn()}
            onDeleteApp={vi.fn()}
            appsById={appsById}
            authWindowAppIds={[]}
            onOpenMyPageSettings={vi.fn()}
          />
        </DndContext>
      </MoabomUiI18nTestProvider>,
    );

    fireEvent.click(screen.getByTestId('moa-shell-create-app'));
    expect(onOpenApp).not.toHaveBeenCalled();

    cleanup();
  });
});
