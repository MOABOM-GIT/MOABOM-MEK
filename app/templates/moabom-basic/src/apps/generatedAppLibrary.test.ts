import { describe, expect, it, vi } from 'vitest';
import { WEBSITE_LINK_APP_GRADIENT } from './ai-generator/websiteLinkApp';
import {
  buildSyntheticGeneratedLibraryApp,
  generatedAppLibraryId,
  mapStoredGeneratedAppToLibraryApp,
  parseGeneratedLibraryServerId,
  tryOpenWebsiteLinkExternalWindow,
} from './generatedAppLibrary';

describe('generatedAppLibrary', () => {
  it('generatedAppLibraryId prefixes stored id', () => {
    expect(generatedAppLibraryId(42)).toBe('generated-app-42');
  });

  it('parseGeneratedLibraryServerId extracts numeric server id', () => {
    expect(parseGeneratedLibraryServerId('generated-app-42')).toBe(42);
    expect(parseGeneratedLibraryServerId('generated-app-0')).toBeNull();
    expect(parseGeneratedLibraryServerId('generated-app-abc')).toBeNull();
    expect(parseGeneratedLibraryServerId('create-app')).toBeNull();
  });

  it('mapStoredGeneratedAppToLibraryApp builds openable library entry', () => {
    const app = mapStoredGeneratedAppToLibraryApp({
      id: 1,
      title: 'My AI App',
      app_type: 'general',
      prompt: 'Build a sleep tracker dashboard',
    });

    expect(app.id).toBe('generated-app-1');
    expect(app.name).toBe('My AI App');
    expect(app.description).toBe('Build a sleep tracker dashboard');
    expect(app.icon).toBe('chart-line');
    expect(app.gradient).toMatch(/^linear-gradient\(135deg,#[0-9a-f]{6},#[0-9a-f]{6}\)$/i);
    expect(app.category).toBe('user');
    expect(app.source).toBe('user-created');
  });

  it('carries token-free preview_url into metadata for AI apps (parallel iframe start)', () => {
    const app = mapStoredGeneratedAppToLibraryApp({
      id: 5,
      title: '공개 앱',
      app_type: 'general',
      preview_url: 'https://apps.mek360.com/g/5',
    });

    expect(app.metadata?.previewUrl).toBe('https://apps.mek360.com/g/5');
  });

  it('omits previewUrl for website link apps (uses websiteUrl seed instead)', () => {
    const app = mapStoredGeneratedAppToLibraryApp({
      id: 6,
      title: '네이버',
      app_type: 'website_link',
      preview_url: 'https://www.naver.com',
      metadata: { website_url: 'https://www.naver.com' },
    });

    expect(app.metadata?.previewUrl).toBeUndefined();
  });

  it('uses stable system-style gradient for the same generated app', () => {
    const first = mapStoredGeneratedAppToLibraryApp({
      id: 3,
      title: '계산기',
      app_type: 'general',
      prompt: '계산기 만들어줘',
    });
    const second = mapStoredGeneratedAppToLibraryApp({
      id: 3,
      title: '계산기',
      app_type: 'general',
      prompt: '다른 설명',
    });

    expect(first.icon).toBe('calculator');
    expect(first.gradient).toBe(second.gradient);
  });

  it('keeps gradient stable when title changes for the same server id', () => {
    const before = mapStoredGeneratedAppToLibraryApp({
      id: 3,
      title: 'App #3',
      app_type: 'general',
    });
    const after = mapStoredGeneratedAppToLibraryApp({
      id: 3,
      title: '실제 앱 이름',
      app_type: 'general',
    });

    expect(before.gradient).toBe(after.gradient);
  });

  it('buildSyntheticGeneratedLibraryApp matches catalog gradient after API load', () => {
    const catalog = mapStoredGeneratedAppToLibraryApp({
      id: 9,
      title: 'Real Name',
      app_type: 'general',
    });
    const synthetic = buildSyntheticGeneratedLibraryApp('generated-app-9');

    expect(synthetic?.gradient).toBe(catalog.gradient);
  });

  it('resolveMainAppsFromOrder omits generated-app ids that are not in the validated library', () => {
    const main = resolveMainAppsFromOrder(['hospital-info', 'generated-app-99'], [], [], true);
    expect(main.map(app => app.id)).toEqual(['hospital-info']);
  });

  it('maps website link apps with favicon metadata and site description', () => {
    const app = mapStoredGeneratedAppToLibraryApp({
      id: 7,
      title: '네이버',
      app_type: 'website_link',
      prompt: '포털 사이트',
      metadata: {
        website_url: 'https://www.naver.com',
        icon_url: 'https://www.google.com/s2/favicons?domain=www.naver.com&sz=128',
      },
    });

    expect(app.name).toBe('네이버');
    expect(app.description).toBe('포털 사이트');
    expect(app.iconImageUrl).toContain('favicons');
    expect(app.metadata).toMatchObject({
      websiteUrl: 'https://www.naver.com',
      launchMode: 'window',
    });
    expect(app.gradient).toBe(WEBSITE_LINK_APP_GRADIENT);
  });

  it('keeps title-icon theme gradient even when a stale icon_url is present', () => {
    const app = mapStoredGeneratedAppToLibraryApp({
      id: 11,
      title: '국민건강보험',
      app_type: 'website_link',
      metadata: {
        website_url: 'https://www.nhis.or.kr/',
        icon_from_title: true,
        theme_color: '#005eb8',
        icon_url: 'https://example.com/stale.ico',
      },
    });

    expect(app.gradient).toMatch(/^linear-gradient\(135deg,#005eb8,/);
    expect(app.iconImageUrl).toBeUndefined();
  });

  it('maps website link title-icon fallback with point color gradient', () => {
    const app = mapStoredGeneratedAppToLibraryApp({
      id: 8,
      title: '국민건강보험',
      app_type: 'website_link',
      prompt: '공단',
      metadata: {
        website_url: 'https://www.nhis.or.kr/',
        icon_from_title: true,
        theme_color: '#005eb8',
        launch_mode: 'new_window',
      },
    });

    expect(app.icon).toBe('notes-medical');
    expect(app.iconImageUrl).toBeUndefined();
    expect(app.gradient).toMatch(/^linear-gradient\(135deg,#005eb8,/);
    expect(app.metadata).toMatchObject({ iconFromTitle: true, launchMode: 'new_window' });
  });

  it('tryOpenWebsiteLinkExternalWindow opens only new_window website links', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const newWindowApp = mapStoredGeneratedAppToLibraryApp({
      id: 9,
      title: '네이버',
      app_type: 'website_link',
      metadata: {
        website_url: 'https://www.naver.com',
        launch_mode: 'new_window',
      },
    });
    const windowApp = mapStoredGeneratedAppToLibraryApp({
      id: 10,
      title: '네이버',
      app_type: 'website_link',
      metadata: {
        website_url: 'https://www.naver.com',
        launch_mode: 'window',
      },
    });

    expect(tryOpenWebsiteLinkExternalWindow(newWindowApp)).toBe(true);
    expect(openSpy).toHaveBeenCalledWith('https://www.naver.com', '_blank', 'noopener,noreferrer');
    expect(tryOpenWebsiteLinkExternalWindow(windowApp)).toBe(false);
    expect(openSpy).toHaveBeenCalledTimes(1);
    openSpy.mockRestore();
  });

  it('keeps owner and permission metadata for generated app windows', () => {
    const app = mapStoredGeneratedAppToLibraryApp({
      id: 2,
      title: 'Shared App',
      app_type: 'general',
      is_shared: true,
      owner: { id: 1, nickname: 'A' },
      permissions: {
        is_owner: false,
        can_edit: true,
        can_share: false,
        can_delete: false,
        edit_mode: 'remix',
      },
    });

    expect(app.metadata).toMatchObject({
      generatedServerId: 2,
      isShared: true,
      owner: { nickname: 'A' },
      permissions: { edit_mode: 'remix' },
    });
  });
});
