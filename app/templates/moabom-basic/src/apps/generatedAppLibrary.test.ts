import { describe, expect, it } from 'vitest';
import {
  generatedAppLibraryId,
  mapStoredGeneratedAppToLibraryApp,
  parseGeneratedLibraryServerId,
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

  it('resolveMainAppsFromOrder omits generated-app ids that are not in the validated library', () => {
    const main = resolveMainAppsFromOrder(['hospital-info', 'generated-app-99'], [], [], true);
    expect(main.map(app => app.id)).toEqual(['hospital-info']);
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
