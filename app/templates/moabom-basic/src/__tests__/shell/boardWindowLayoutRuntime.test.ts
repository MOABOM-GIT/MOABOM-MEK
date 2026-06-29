import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildBoardSessionKey,
  calculateBoardLayoutComputed,
  extractBoardComponents,
} from '../../shell/boardWindowLayoutRuntime';

const here = dirname(fileURLToPath(import.meta.url));
const componentsJson = JSON.parse(
  readFileSync(resolve(here, '../../../components.json'), 'utf8'),
) as { layout?: Array<{ name: string }> };

const COMMENT_ROOT_MAP_EXPR =
  '{{(post?.data?.comments ?? []).reduce((map, c) => ({...map, [c.id]: c.depth === 0 ? c.id : (map[c.parent_id] ?? c.parent_id)}), {})}}';

describe('boardWindowLayoutRuntime', () => {
  it('moabom-basic ComponentRegistry 에 Fragment 가 없다 (Fragment 루트 래핑 시 빈 DOM)', () => {
    const layoutNames = (componentsJson.layout ?? []).map(entry => entry.name);
    expect(layoutNames).not.toContain('Fragment');
    expect(layoutNames).toContain('Container');
  });

  it('extractBoardComponents 는 layout.components 를 그대로 반환한다', () => {
    const layout = {
      components: [
        { id: 'toast', type: 'composite', name: 'Toast' },
        { id: 'board-body', type: 'layout', name: 'Container' },
      ],
    };
    expect(extractBoardComponents(layout)).toHaveLength(2);
    expect(extractBoardComponents(layout)[0]?.name).toBe('Toast');
  });

  it('buildBoardSessionKey 는 slug 와 post id 로 세션 키를 만든다', () => {
    expect(buildBoardSessionKey({ slug: 'notice', id: '42' })).toBe('notice:42');
    expect(buildBoardSessionKey({ slug: 'free' })).toBe('free:');
  });

  it('calculateBoardLayoutComputed 는 commentRootMap 을 평가한다', () => {
    const dataContext = {
      post: {
        data: {
          comments: [
            { id: 10, depth: 0, parent_id: null },
            { id: 11, depth: 1, parent_id: 10 },
            { id: 12, depth: 1, parent_id: 10 },
          ],
        },
      },
    };

    const priorG7 = (globalThis as { G7Core?: unknown }).G7Core;
    (globalThis as { G7Core?: unknown }).G7Core = {
      getDataBindingEngine: () => ({
        evaluateExpression: (expr: string, ctx: Record<string, unknown>) => {
          const keys = Object.keys(ctx);
          const values = keys.map(key => ctx[key]);
          // eslint-disable-next-line no-new-func
          return new Function(...keys, `return (${expr});`)(...values);
        },
      }),
    };

    try {
      const computed = calculateBoardLayoutComputed(
        { commentRootMap: COMMENT_ROOT_MAP_EXPR },
        dataContext,
      );

      expect(computed.commentRootMap).toEqual({
        10: 10,
        11: 10,
        12: 10,
      });
    } finally {
      (globalThis as { G7Core?: unknown }).G7Core = priorG7;
    }
  });
});
