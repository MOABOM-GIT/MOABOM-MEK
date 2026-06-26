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
      const frame = screen.getByTitle('Naver') as HTMLIFrameElement;
      expect(frame.src).toContain('https://www.naver.com');
      expect(frame.getAttribute('sandbox')).toBe('allow-scripts allow-forms allow-popups allow-same-origin');
    });
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
        edit_mode: 'none',
      },
    });

    renderViewer(7);

    const creatorButton = await screen.findByRole('button', { name: 'A' });
    fireEvent.click(creatorButton);

    expect(screen.queryByLabelText('moa_mypage.library.edit_app')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('moa_mypage.library.share_app')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('moa_mypage.library.delete_app')).not.toBeInTheDocument();
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
});
