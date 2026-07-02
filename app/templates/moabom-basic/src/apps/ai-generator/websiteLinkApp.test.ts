import { describe, expect, it } from 'vitest';
import {
  buildWebsiteLinkSaveMetadata,
  buildWebsiteLinkStoredHtml,
  isInternalWebsiteIconUrl,
  isWebsiteTitleIconFromMetadata,
  normalizeWebsiteUrl,
  readWebsiteUrlFromStoredHtml,
  resolveWebsiteLinkAppGradient,
  stripWebsiteLinkIconServingMetadata,
  readWebsiteLinkPreviewFromMetadata,
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

  it('uses point-color gradient for title-icon website links', () => {
    expect(isWebsiteTitleIconFromMetadata({ icon_from_title: true })).toBe(true);
    expect(resolveWebsiteLinkAppGradient({ icon_from_title: true, theme_color: '#005eb8' }, false))
      .toMatch(/^linear-gradient\(135deg,#005eb8,/);
    expect(resolveWebsiteLinkAppGradient({ icon_from_title: true }, true)).toContain('#f8fafc');
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
      theme_color: '#005eb8',
      icon_source_url: 'https://example.com/favicon.ico',
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
