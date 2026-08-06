import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { MoabomUiI18nContext } from '../../i18n/MoabomUiI18nProvider';
import { GeneratedAppViewer } from './GeneratedAppViewer';

const identityT = (key: string) => key;

vi.mock('../../api/moabomAppsApi', () => ({
  fetchVisibleGeneratedApp: vi.fn(),
}));

import { fetchVisibleGeneratedApp } from '../../api/moabomAppsApi';
import { invalidateVisibleGeneratedAppSession } from './generatedAppVisibleSessionCache';

function renderViewer(serverId: number) {
  return render(
    <MoabomUiI18nContext.Provider value={{ t: identityT, language: 'ko' }}>
      <GeneratedAppViewer serverId={serverId} />
    </MoabomUiI18nContext.Provider>,
  );
}

describe('GeneratedAppViewer', () => {
  afterEach(() => {
    cleanup();
    vi.mocked(fetchVisibleGeneratedApp).mockReset();
    invalidateVisibleGeneratedAppSession(7);
    invalidateVisibleGeneratedAppSession(9);
    invalidateVisibleGeneratedAppSession(11);
  });

  it('loads website_link app into iframe via metadata URL', async () => {
    vi.mocked(fetchVisibleGeneratedApp).mockResolvedValue({
      id: 9,
      title: 'Naver',
      app_type: 'website_link',
      html: '<!DOCTYPE html><html><body data-moabom-website-link="1"></body></html>',
      preview_url: 'https://apps.mek360.com/g/9',
      metadata: { website_url: 'https://www.naver.com' },
    });

    renderViewer(9);

    await waitFor(() => {
      expect(fetchVisibleGeneratedApp).toHaveBeenCalledWith(9, { includeHtml: false });
      const frame = screen.getByTitle('Naver') as HTMLIFrameElement;
      expect(frame.src).toContain('https://www.naver.com');
      expect(frame.getAttribute('sandbox')).toBe(
        'allow-scripts allow-forms allow-modals allow-popups allow-same-origin',
      );
    });
  });

  it('shows new_window placeholder without shell iframe and reopens on button click', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({
      closed: false,
      focus: vi.fn(),
    } as unknown as Window);

    vi.mocked(fetchVisibleGeneratedApp).mockResolvedValue({
      id: 11,
      title: 'Naver',
      app_type: 'website_link',
      html: '<!DOCTYPE html><html><body data-moabom-website-link="1"></body></html>',
      preview_url: 'https://apps.mek360.com/g/11',
      metadata: {
        website_url: 'https://www.naver.com',
        launch_mode: 'new_window',
      },
    });

    renderViewer(11);

    await waitFor(() => {
      expect(screen.getByText('moa_apps_ai.external_launch_title')).toBeInTheDocument();
      expect(screen.queryByTitle('Naver')).not.toBeInTheDocument();
    });
    // 최초 open 은 아이콘 클릭(openApp) 제스처에서 수행 — 뷰어 마운트만으로는 열지 않음
    expect(openSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /moa_apps_ai.external_launch_reopen/i }));
    expect(openSpy).toHaveBeenCalledWith(
      'https://www.naver.com',
      '_blank',
      'noopener,noreferrer',
    );

    openSpy.mockRestore();
  });

  it('loads saved app into iframe preview via preview_url', async () => {
    vi.mocked(fetchVisibleGeneratedApp).mockResolvedValue({
      id: 7,
      title: 'Sleep Tracker',
      app_type: 'general',
      tier: 'standard',
      preview_url: 'https://smoke.mek360.com/modules/moabom-apps/preview/g/7',
      html: '<!DOCTYPE html><html><head></head><body><p>Hello</p></body></html>',
      preview_url: 'https://smoke.mek360.com/modules/moabom-apps/preview/g/7',
    });

    renderViewer(7);

    await waitFor(() => {
      const frame = screen.getByTitle('Sleep Tracker') as HTMLIFrameElement;
      expect(frame.tagName).toBe('IFRAME');
      expect(frame.src).toContain('/modules/moabom-apps/preview/g/7');
    });
  });

  it('shows error when fetch fails', async () => {
    vi.mocked(fetchVisibleGeneratedApp).mockRejectedValue(new Error('권한 없음'));

    renderViewer(9);

    await waitFor(() => {
      expect(screen.getByText('권한 없음')).toBeInTheDocument();
    });
  });

  it('shows creator button and expands owner actions on click', async () => {
    const onEditGeneratedApp = vi.fn();
    vi.mocked(fetchVisibleGeneratedApp).mockResolvedValue({
      id: 7,
      title: 'Sleep Tracker',
      app_type: 'general',
      html: '<!DOCTYPE html><html><head></head><body><p>Hello</p></body></html>',
      preview_url: 'https://smoke.mek360.com/modules/moabom-apps/preview/g/7',
      is_shared: false,
      owner: { id: 1, nickname: 'A' },
      permissions: {
        is_owner: true,
        can_edit: true,
        can_share: true,
        can_delete: true,
        edit_mode: 'owner',
      },
    });

    render(
      <MoabomUiI18nContext.Provider value={{ t: identityT, language: 'ko' }}>
        <GeneratedAppViewer serverId={7} onEditGeneratedApp={onEditGeneratedApp} />
      </MoabomUiI18nContext.Provider>,
    );

    const creatorButton = await screen.findByRole('button', { name: 'A' });
    const editButton = screen.getByLabelText('moa_mypage.library.edit_app');
    expect(editButton.parentElement?.className).toContain('is-closed');

    fireEvent.click(creatorButton);

    expect(editButton.parentElement?.className).toContain('is-open');
  });

  it('does not render an empty action menu for guests', async () => {
    vi.mocked(fetchVisibleGeneratedApp).mockResolvedValue({
      id: 7,
      title: 'Sleep Tracker',
      app_type: 'general',
      html: '<!DOCTYPE html><html><head></head><body><p>Hello</p></body></html>',
      preview_url: 'https://smoke.mek360.com/modules/moabom-apps/preview/g/7',
      is_shared: true,
      owner: { id: 1, nickname: 'A' },
      permissions: {
        is_owner: false,
        can_edit: false,
        can_share: false,
        can_delete: false,
        can_community_read: true,
        can_community_write: false,
        edit_mode: 'none',
      },
    });

    renderViewer(7);

    const creatorButton = await screen.findByRole('button', { name: 'A' });
    expect(creatorButton.className).toContain('moa-pointer-draggable');
    expect(creatorButton.className).not.toContain('is-actionable');
    fireEvent.click(creatorButton);

    expect(screen.queryByLabelText('moa_mypage.library.edit_app')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('moa_apps_ai.community.open')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('moa_mypage.library.share_app')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('moa_mypage.library.delete_app')).not.toBeInTheDocument();
  });

  it('applies dark-backdrop liquid glass class from saved app background', async () => {
    vi.mocked(fetchVisibleGeneratedApp).mockResolvedValue({
      id: 7,
      title: 'Dark Dashboard',
      app_type: 'general',
      html: '<!DOCTYPE html><html><head><style>body{background:#020617}</style></head><body></body></html>',
      preview_url: 'https://smoke.mek360.com/modules/moabom-apps/preview/g/7',
      owner: { id: 1, nickname: 'A' },
    });

    renderViewer(7);

    const creatorButton = await screen.findByRole('button', { name: 'A' });
    expect(creatorButton.className).toContain('liquid-glass--on-dark');
  });

  it('applies dark-backdrop liquid glass class from Tailwind root background', async () => {
    vi.mocked(fetchVisibleGeneratedApp).mockResolvedValue({
      id: 7,
      title: 'Dark Dashboard',
      app_type: 'general',
      html: '<!DOCTYPE html><html><body><div id="root" class="min-h-screen bg-slate-950"></div></body></html>',
      preview_url: 'https://smoke.mek360.com/modules/moabom-apps/preview/g/7',
      owner: { id: 1, nickname: 'A' },
    });

    renderViewer(7);

    const creatorButton = await screen.findByRole('button', { name: 'A' });
    expect(creatorButton.className).toContain('liquid-glass--on-dark');
  });

  it('updates share button state immediately after toggle', async () => {
    const onToggleGeneratedAppShare = vi.fn().mockResolvedValue(undefined);
    vi.mocked(fetchVisibleGeneratedApp).mockResolvedValue({
      id: 7,
      title: 'Sleep Tracker',
      app_type: 'general',
      html: '<!DOCTYPE html><html><head></head><body><p>Hello</p></body></html>',
      preview_url: 'https://smoke.mek360.com/modules/moabom-apps/preview/g/7',
      is_shared: false,
      owner: { id: 1, nickname: 'A' },
      permissions: {
        is_owner: true,
        can_edit: true,
        can_share: true,
        can_delete: true,
        edit_mode: 'owner',
      },
    });

    render(
      <MoabomUiI18nContext.Provider value={{ t: identityT, language: 'ko' }}>
        <GeneratedAppViewer serverId={7} onToggleGeneratedAppShare={onToggleGeneratedAppShare} />
      </MoabomUiI18nContext.Provider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'A' }));
    const shareButton = screen.getByLabelText('moa_mypage.library.share_app');
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(onToggleGeneratedAppShare).toHaveBeenCalledWith(7, true);
      expect(screen.getByLabelText('moa_mypage.library.unshare_app')).toBeInTheDocument();
    });
  });

  it('does not toggle menu when owner chip is dragged', async () => {
    vi.mocked(fetchVisibleGeneratedApp).mockResolvedValue({
      id: 7,
      title: 'Sleep Tracker',
      app_type: 'general',
      html: '<!DOCTYPE html><html><head></head><body><p>Hello</p></body></html>',
      preview_url: 'https://smoke.mek360.com/modules/moabom-apps/preview/g/7',
      is_shared: false,
      owner: { id: 1, nickname: 'A' },
      permissions: {
        is_owner: true,
        can_edit: true,
        can_share: true,
        can_delete: true,
        edit_mode: 'owner',
      },
    });

    render(
      <MoabomUiI18nContext.Provider value={{ t: identityT, language: 'ko' }}>
        <GeneratedAppViewer serverId={7} />
      </MoabomUiI18nContext.Provider>,
    );

    const creatorButton = await screen.findByRole('button', { name: 'A' });
    const toolbar = creatorButton.closest('.generated-app-toolbar') as HTMLElement;
    const container = toolbar.parentElement as HTMLElement;

    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      toJSON: () => ({}),
    });
    vi.spyOn(toolbar, 'getBoundingClientRect').mockReturnValue({
      x: 12,
      y: 548,
      left: 12,
      top: 548,
      right: 112,
      bottom: 580,
      width: 100,
      height: 32,
      toJSON: () => ({}),
    });
    Object.defineProperty(toolbar, 'offsetWidth', { configurable: true, value: 100 });
    Object.defineProperty(toolbar, 'offsetHeight', { configurable: true, value: 32 });
    Object.defineProperty(container, 'clientWidth', { configurable: true, value: 800 });
    Object.defineProperty(container, 'clientHeight', { configurable: true, value: 600 });

    const editButton = screen.getByLabelText('moa_mypage.library.edit_app');
    expect(editButton.parentElement?.className).toContain('is-closed');

    fireEvent.pointerDown(creatorButton, { clientX: 20, clientY: 560, pointerId: 1, button: 0 });
    fireEvent.pointerMove(creatorButton, { clientX: 60, clientY: 500, pointerId: 1, buttons: 1 });
    fireEvent.pointerUp(creatorButton, { clientX: 60, clientY: 500, pointerId: 1 });
    fireEvent.click(creatorButton);

    expect(editButton.parentElement?.className).toContain('is-closed');
    expect(toolbar.style.left).not.toBe('');
    expect(toolbar.style.top).not.toBe('');
  });

  it('keeps loading overlay until iframe readiness signals arrive', async () => {
    vi.mocked(fetchVisibleGeneratedApp).mockResolvedValue({
      id: 7,
      title: 'Sleep Tracker',
      app_type: 'general',
      html: '<!DOCTYPE html><html><head></head><body><p>Hello</p></body></html>',
      preview_url: 'https://smoke.mek360.com/modules/moabom-apps/preview/g/7',
      owner: { id: 1, nickname: 'A' },
    });

    renderViewer(7);

    await screen.findByTitle('Sleep Tracker');
    expect(screen.getByRole('status', { name: 'moa_apps_ai.viewer_loading' })).toBeInTheDocument();

    const frame = screen.getByTitle('Sleep Tracker') as HTMLIFrameElement;
    Object.defineProperty(frame, 'contentWindow', {
      configurable: true,
      value: window,
    });

    window.dispatchEvent(
      new MessageEvent('message', {
        source: window,
        data: { source: 'moabom-app', type: 'backdrop-tone', tone: 'light' },
      }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: 'moa_apps_ai.viewer_loading' })).not.toBeInTheDocument();
    });
    expect(frame.className).toContain('is-ready');
  });

  it('does not treat a hidden browser tab as an app freeze', async () => {
    vi.mocked(fetchVisibleGeneratedApp).mockResolvedValue({
      id: 7,
      title: 'Sleep Tracker',
      app_type: 'general',
      html: '<!DOCTYPE html><html><head></head><body><p>Hello</p></body></html>',
      preview_url: 'https://smoke.mek360.com/modules/moabom-apps/preview/g/7',
      owner: { id: 1, nickname: 'A' },
    });

    renderViewer(7);
    await screen.findByTitle('Sleep Tracker');

    const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });

    vi.useFakeTimers();
    try {
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(20_000);
      expect(screen.queryByText('moa_apps_ai.frozen_title')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
      if (visibilityDescriptor) {
        Object.defineProperty(document, 'visibilityState', visibilityDescriptor);
      }
    }
  });

  it('downloads files from iframe postMessage in parent document', async () => {
    vi.mocked(fetchVisibleGeneratedApp).mockResolvedValue({
      id: 7,
      title: 'EngiCalc',
      app_type: 'general',
      html: '<!DOCTYPE html><html><head></head><body><p>Hello</p></body></html>',
      preview_url: 'https://26.apps.mek360.com/',
      owner: { id: 1, nickname: 'A' },
    });

    const click = vi.fn();
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      Object.defineProperty(node, 'click', { value: click });
      return node;
    });
    vi.spyOn(HTMLElement.prototype, 'remove').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    renderViewer(7);

    const frame = await screen.findByTitle('EngiCalc');
    const iframe = frame as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: window,
    });

    window.dispatchEvent(
      new MessageEvent('message', {
        source: window,
        data: {
          source: 'moabom-app',
          type: 'file-download',
          filename: 'calc-log.csv',
          mimeType: 'text/csv',
          encoding: 'utf8',
          data: 'a,b,c',
        },
      }),
    );

    expect(click).toHaveBeenCalledTimes(1);
  });
});
