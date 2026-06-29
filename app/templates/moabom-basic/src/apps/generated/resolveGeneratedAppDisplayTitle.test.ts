import { describe, expect, it, vi } from 'vitest';

import {
  isGeneratedAppIdPlaceholderTitle,
  pickGeneratedAppDisplayTitle,
  resolveGeneratedAppDisplayTitle,
} from './resolveGeneratedAppDisplayTitle';

vi.mock('./generatedAppVisibleSessionCache', () => ({
  loadVisibleGeneratedAppSession: vi.fn(),
}));

import { loadVisibleGeneratedAppSession } from './generatedAppVisibleSessionCache';

describe('resolveGeneratedAppDisplayTitle', () => {
  it('detects App #id placeholder titles', () => {
    expect(isGeneratedAppIdPlaceholderTitle('App #24')).toBe(true);
    expect(isGeneratedAppIdPlaceholderTitle('앱 #24')).toBe(true);
    expect(isGeneratedAppIdPlaceholderTitle('수면 계산기')).toBe(false);
  });

  it('pickGeneratedAppDisplayTitle skips placeholders', () => {
    expect(pickGeneratedAppDisplayTitle('App #3', '실제 앱')).toBe('실제 앱');
    expect(pickGeneratedAppDisplayTitle('App #3')).toBe('');
  });

  it('resolveGeneratedAppDisplayTitle prefers preferredTitle over session', async () => {
    const appName = await resolveGeneratedAppDisplayTitle({
      serverId: 24,
      authStateKey: '7',
      preferredTitle: '수면 계산기',
      catalogTitle: 'App #24',
      untitledLabel: '제목 없는 앱',
    });

    expect(appName).toBe('수면 계산기');
    expect(loadVisibleGeneratedAppSession).not.toHaveBeenCalled();
  });

  it('resolveGeneratedAppDisplayTitle loads session title when catalog is placeholder', async () => {
    vi.mocked(loadVisibleGeneratedAppSession).mockResolvedValueOnce({
      id: 24,
      title: '  리뷰 앱  ',
    } as never);

    const appName = await resolveGeneratedAppDisplayTitle({
      serverId: 24,
      authStateKey: '7',
      catalogTitle: 'App #24',
      untitledLabel: '제목 없는 앱',
    });

    expect(appName).toBe('리뷰 앱');
  });
});
