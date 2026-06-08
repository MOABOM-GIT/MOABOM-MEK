import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { MoabomUiI18nContext } from '../../i18n/MoabomUiI18nProvider';
import { GeneratedAppViewer } from './GeneratedAppViewer';

const identityT = (key: string) => key;

vi.mock('../../api/moabomAppsApi', () => ({
  fetchGeneratedApp: vi.fn(),
}));

import { fetchGeneratedApp } from '../../api/moabomAppsApi';

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
    vi.mocked(fetchGeneratedApp).mockReset();
  });

  it('loads saved app html into iframe preview', async () => {
    vi.mocked(fetchGeneratedApp).mockResolvedValue({
      id: 7,
      title: 'Sleep Tracker',
      app_type: 'general',
      html: '<!DOCTYPE html><html><head></head><body><p>Hello</p></body></html>',
    });

    renderViewer(7);

    await waitFor(() => {
      expect(screen.getByTitle('Sleep Tracker')).toBeInTheDocument();
    });
  });

  it('shows error when fetch fails', async () => {
    vi.mocked(fetchGeneratedApp).mockRejectedValue(new Error('권한 없음'));

    renderViewer(9);

    await waitFor(() => {
      expect(screen.getByText('권한 없음')).toBeInTheDocument();
    });
  });
});
