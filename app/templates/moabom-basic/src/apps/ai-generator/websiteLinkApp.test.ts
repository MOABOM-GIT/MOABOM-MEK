import { describe, expect, it } from 'vitest';
import {
  buildWebsiteLinkStoredHtml,
  isWebsiteTitleIconFromMetadata,
  normalizeWebsiteUrl,
  readWebsiteUrlFromStoredHtml,
  resolveWebsiteLinkAppGradient,
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
});
