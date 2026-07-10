import { describe, expect, it } from 'vitest';
import {
  buildWebsiteLinkSaveMetadata,
  buildWebsiteLinkStoredHtml,
  isInternalWebsiteIconUrl,
  isWebsiteLinkNewWindowLaunch,
  isWebsiteTitleIconFromMetadata,
  normalizeWebsiteUrl,
  readWebsiteLinkLaunchModeFromMetadata,
  readWebsiteUrlFromStoredHtml,
  resolveWebsiteLinkAppGradient,
  stripWebsiteLinkIconServingMetadata,
  readWebsiteLinkPreviewFromMetadata,
  WEBSITE_LINK_LAUNCH_MODE_NEW_WINDOW,
  WEBSITE_LINK_LAUNCH_MODE_WINDOW,
} from './websiteLinkApp';

describe('websiteLinkApp', () => {
  it('normalizeWebsiteUrl prepends https when scheme is missing', () => {
    expect(normalizeWebsiteUrl('www.naver.com')).toBe('https://www.naver.com');
    expect(normalizeWebsiteUrl('https://naver.com')).toBe('https://naver.com');
  });

  it('buildWebsiteLinkStoredHtml is a placeholder without embed iframe', () => {
    const html = buildWebsiteLinkStoredHtml('네이버');

    expect(html).toContain('<title>네이버</title>');
    expect(html).toContain('data-moabom-website-link="1"');
    expect(html).not.toContain('<iframe');
    expect(html.length).toBeGreaterThanOrEqual(20);
  });

  it('readWebsiteUrlFromStoredHtml extracts legacy wrapper iframe src', () => {
    const legacy = '<body><iframe src="https://www.naver.com" title="N"></iframe></body>';

    expect(readWebsiteUrlFromStoredHtml(legacy)).toBe('https://www.naver.com');
  });

  it('uses point-color gradient for title-icon website links regardless of favicon presence', () => {
    expect(isWebsiteTitleIconFromMetadata({ icon_from_title: true })).toBe(true);
    expect(resolveWebsiteLinkAppGradient({ icon_from_title: true, theme_color: '#005eb8' }, false))
      .toMatch(/^linear-gradient\(135deg,#005eb8,/);
    expect(resolveWebsiteLinkAppGradient({ icon_from_title: true, theme_color: '#005eb8' }, true))
      .toMatch(/^linear-gradient\(135deg,#005eb8,/);
    expect(resolveWebsiteLinkAppGradient({ icon_from_title: false }, true)).toContain('#f8fafc');
    expect(resolveWebsiteLinkAppGradient({}, false)).toContain('#f8fafc');
  });

  it('buildWebsiteLinkSaveMetadata sends external icon source only', () => {
    expect(buildWebsiteLinkSaveMetadata({
      websiteUrl: 'https://example.com',
      resolvedIconUrl: 'https://example.com/favicon.ico',
      themeColor: '#005eb8',
      iconFromTitle: false,
    })).toEqual({
      website_url: 'https://example.com',
      icon_from_title: false,
      launch_mode: WEBSITE_LINK_LAUNCH_MODE_WINDOW,
      theme_color: '#005eb8',
      icon_source_url: 'https://example.com/favicon.ico',
    });
  });

  it('persists and reads website launch_mode', () => {
    expect(readWebsiteLinkLaunchModeFromMetadata(undefined)).toBe(WEBSITE_LINK_LAUNCH_MODE_WINDOW);
    expect(readWebsiteLinkLaunchModeFromMetadata({ launch_mode: 'new_window' }))
      .toBe(WEBSITE_LINK_LAUNCH_MODE_NEW_WINDOW);
    expect(isWebsiteLinkNewWindowLaunch({ launch_mode: 'new_window' })).toBe(true);
    expect(buildWebsiteLinkSaveMetadata({
      websiteUrl: 'https://example.com',
      resolvedIconUrl: '',
      themeColor: '',
      iconFromTitle: true,
      launchMode: WEBSITE_LINK_LAUNCH_MODE_NEW_WINDOW,
    })).toMatchObject({
      website_url: 'https://example.com',
      launch_mode: WEBSITE_LINK_LAUNCH_MODE_NEW_WINDOW,
      icon_from_title: true,
    });
  });

  it('buildWebsiteLinkSaveMetadata omits internal website-icon url', () => {
    const metadata = buildWebsiteLinkSaveMetadata({
      websiteUrl: 'https://example.com',
      resolvedIconUrl: '/api/modules/moabom-apps/apps/generated/9/website-icon',
      themeColor: '',
      iconFromTitle: false,
      appId: 9,
    });

    expect(metadata.icon_source_url).toBeUndefined();
    expect(metadata.icon_url).toBeUndefined();
  });

  it('stripWebsiteLinkIconServingMetadata removes server-owned icon fields', () => {
    expect(stripWebsiteLinkIconServingMetadata({
      website_url: 'https://example.com',
      icon_url: '/api/modules/moabom-apps/apps/generated/1/website-icon',
      stored_icon_path: '1/website-icon.png',
      icon_mime: 'image/png',
    })).toEqual({
      website_url: 'https://example.com',
    });
  });

  it('detects internal website icon urls', () => {
    expect(isInternalWebsiteIconUrl('/api/modules/moabom-apps/apps/generated/3/website-icon', 3)).toBe(true);
    expect(isInternalWebsiteIconUrl('https://example.com/favicon.ico', 3)).toBe(false);
  });

  it('readWebsiteLinkPreviewFromMetadata maps server metadata to preview state', () => {
    expect(readWebsiteLinkPreviewFromMetadata({
      icon_url: '/api/modules/moabom-apps/apps/generated/3/website-icon',
      icon_from_title: false,
      theme_color: '#005eb8',
    })).toEqual({
      iconUrl: '/api/modules/moabom-apps/apps/generated/3/website-icon',
      iconFromTitle: false,
      themeColor: '#005eb8',
    });

    expect(readWebsiteLinkPreviewFromMetadata({
      icon_from_title: true,
      theme_color: '#111111',
    })).toEqual({
      iconUrl: '',
      iconFromTitle: true,
      themeColor: '#111111',
    });
  });
});
