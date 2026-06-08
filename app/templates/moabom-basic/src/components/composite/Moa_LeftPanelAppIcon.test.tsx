import { DndContext } from '@dnd-kit/core';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MoabomUiI18nTestProvider } from '../../i18n/moabomShellTestI18n';
import { LeftPanelAppIcon } from './Moa_LeftPanelAppIcon';
import type { App } from '../../data/Moa_apps';

const mockApp: App = {
  id: 'test-app',
  name: '테스트',
  description: '설명',
  icon: 'cube',
  gradient: 'linear-gradient(135deg,#6366f1,#4f46e5)',
  category: 'basic',
  source: 'system',
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderIcon(options: { fullWidth?: boolean } = {}) {
  const noop = () => {};
  return render(
    <MoabomUiI18nTestProvider>
      <DndContext>
        <LeftPanelAppIcon
          app={mockApp}
          editMode={false}
          onEnterEditMode={noop}
          onOpenApp={noop}
          fullWidth={options.fullWidth}
        />
      </DndContext>
    </MoabomUiI18nTestProvider>,
  );
}

describe('LeftPanelAppIcon', () => {
  it('fullWidth=false일 때 플렉스 행에서 옆 영역을 밀지 않도록 루트에 shrink-0을 쓴다', () => {
    const { container } = renderIcon({ fullWidth: false });
    const root = container.firstChild as HTMLElement;
    const classes = root.className.split(/\s+/).filter(Boolean);
    expect(classes).toContain('shrink-0');
    expect(classes).not.toContain('w-full');
  });

  it('기본(fullWidth)일 때 그리드용 w-full을 쓴다', () => {
    const { container } = renderIcon();
    const root = container.firstChild as HTMLElement;
    expect(root.className.split(/\s+/).filter(Boolean)).toContain('w-full');
  });
});
