import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/moabomAppsApi', () => ({
  fetchVisibleGeneratedApp: vi.fn(),
}));

import { fetchVisibleGeneratedApp, type StoredGeneratedApp } from '../../api/moabomAppsApi';
import {
  invalidateVisibleGeneratedAppSession,
  loadVisibleGeneratedAppSession,
} from './generatedAppVisibleSessionCache';

const metaApp: StoredGeneratedApp = {
  id: 42,
  title: 'Meta',
  app_type: 'general',
  preview_url: 'https://apps.mek360.com/g/42',
};

const fullApp: StoredGeneratedApp = {
  ...metaApp,
  html: '<!DOCTYPE html><html><body>x</body></html>',
};

describe('generatedAppVisibleSessionCache', () => {
  afterEach(() => {
    invalidateVisibleGeneratedAppSession(42);
    vi.mocked(fetchVisibleGeneratedApp).mockReset();
  });

  it('viewer path requests includeHtml false', async () => {
    vi.mocked(fetchVisibleGeneratedApp).mockResolvedValue(metaApp);

    const result = await loadVisibleGeneratedAppSession(42, 'user-1', { includeHtml: false });

    expect(fetchVisibleGeneratedApp).toHaveBeenCalledWith(42, { includeHtml: false });
    expect(result.html).toBeUndefined();
  });

  it('edit/remix path requests includeHtml true', async () => {
    vi.mocked(fetchVisibleGeneratedApp).mockResolvedValue(fullApp);

    const result = await loadVisibleGeneratedAppSession(42, 'user-1', { includeHtml: true });

    expect(fetchVisibleGeneratedApp).toHaveBeenCalledWith(42, { includeHtml: true });
    expect(result.html).toContain('<body>x</body>');
  });

  it('reuses full cache for meta request without second fetch', async () => {
    vi.mocked(fetchVisibleGeneratedApp).mockResolvedValue(fullApp);

    await loadVisibleGeneratedAppSession(42, 'user-1', { includeHtml: true });
    const meta = await loadVisibleGeneratedAppSession(42, 'user-1', { includeHtml: false });

    expect(fetchVisibleGeneratedApp).toHaveBeenCalledTimes(1);
    expect(meta.html).toContain('<body>x</body>');
  });

  it('does not reuse meta cache for html request', async () => {
    vi.mocked(fetchVisibleGeneratedApp)
      .mockResolvedValueOnce(metaApp)
      .mockResolvedValueOnce(fullApp);

    await loadVisibleGeneratedAppSession(42, 'user-1', { includeHtml: false });
    const full = await loadVisibleGeneratedAppSession(42, 'user-1', { includeHtml: true });

    expect(fetchVisibleGeneratedApp).toHaveBeenCalledTimes(2);
    expect(full.html).toContain('<body>x</body>');
  });
});
