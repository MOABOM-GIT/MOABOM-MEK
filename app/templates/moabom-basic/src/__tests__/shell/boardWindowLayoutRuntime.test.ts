import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { extractBoardComponents } from '../../shell/boardWindowLayoutRuntime';

const here = dirname(fileURLToPath(import.meta.url));
const componentsJson = JSON.parse(
  readFileSync(resolve(here, '../../../components.json'), 'utf8'),
) as { layout?: Array<{ name: string }> };

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
});
