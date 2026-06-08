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
    expect(app.category).toBe('user');
    expect(app.source).toBe('user-created');
  });
});
