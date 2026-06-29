import { describe, expect, it, vi } from 'vitest';
import { registerBoardWindowDataSession } from '../../shell/boardWindowDataBridge';
import type { BoardWindowRenderPayload } from '../../shell/boardWindowLayoutRuntime';

function makePayload(dataContext: Record<string, unknown> = {}): BoardWindowRenderPayload {
  return {
    DynamicRenderer: () => null,
    componentDefs: [],
    dataContext,
    translationContext: { templateId: 'moabom-basic', locale: 'ko' },
    registry: null,
    bindingEngine: null,
    translationEngine: null,
    actionDispatcher: null,
    layoutName: 'board/show',
    boardSessionKey: 'notice:42',
    layoutDataSources: [{ id: 'post', endpoint: '/api/test', auto_fetch: true }],
    layoutComputed: undefined,
    route: { slug: 'notice', id: '42' },
    query: {},
  };
}

describe('boardWindowDataBridge', () => {
  it('G7Core.dataSource.set 이 셸 세션 dataContext 를 갱신한다', () => {
    const originalSet = vi.fn();
    const g7 = {
      G7Core: {
        dataSource: {
          refetch: vi.fn(),
          set: originalSet,
        },
      },
    };
    const prior = (globalThis as { G7Core?: unknown }).G7Core;
    (globalThis as { G7Core?: unknown }).G7Core = g7;

    const changes: Record<string, unknown>[] = [];
    const unregister = registerBoardWindowDataSession(makePayload({ post: { data: { content: null } } }), next => {
      changes.push(next);
    });

    try {
      g7.G7Core.dataSource.set('post', { success: true, data: { content: 'secret body' } });

      expect(originalSet).not.toHaveBeenCalled();
      expect(changes.at(-1)?.post).toEqual({ success: true, data: { content: 'secret body' } });
    } finally {
      unregister();
      (globalThis as { G7Core?: unknown }).G7Core = prior;
    }
  });
});
