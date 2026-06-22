import { describe, expect, it } from 'vitest';
import {
  extractServerMainAppOrder,
  extractServerMainAppOrderCustomized,
  mergeMainAppOrderFromPull,
  materializeOrderForMutation,
  pruneStaleGeneratedAppOrderIds,
  resolveMainAppsFromOrder,
  sanitizeMainAppOrderIds,
} from './moaShellAppOrder';
import { createAppShellMetadata } from '../apps/ai-generator/metadata';
import { APPS } from '../data/Moa_apps';

describe('moaShellAppOrder', () => {
  it('sanitizeMainAppOrderIds removes duplicates and legacy ai-generator id', () => {
    expect(sanitizeMainAppOrderIds(['cpap-mask', 'ai-generator', 'cpap-mask', 'generated-app-42'])).toEqual([
      'cpap-mask',
      'generated-app-42',
    ]);
  });

  it('extractServerMainAppOrder reads shell.home.mainAppOrder', () => {
    expect(extractServerMainAppOrder({
      shell: {
        home: {
          mainAppOrder: ['mypage', 'generated-app-7'],
        },
      },
    })).toEqual(['mypage', 'generated-app-7']);
  });

  it('extractServerMainAppOrderCustomized reads explicit flag or infers from order array', () => {
    expect(extractServerMainAppOrderCustomized({
      shell: { home: { mainAppOrderCustomized: false } },
    })).toBe(false);
    expect(extractServerMainAppOrderCustomized({
      shell: { home: { mainAppOrder: [] } },
    })).toBe(true);
  });

  it('mergeMainAppOrderFromPull prefers server customized order for logged-in users', () => {
    expect(mergeMainAppOrderFromPull({
      isLoggedIn: true,
      trustLocalDuringCooldown: false,
      localOrder: ['cpap-mask'],
      localCustomized: true,
      serverOrder: ['generated-app-42', 'mypage'],
      serverCustomized: true,
    })).toEqual({ order: ['generated-app-42', 'mypage'], customized: true });
  });

  it('mergeMainAppOrderFromPull keeps local order during save cooldown', () => {
    expect(mergeMainAppOrderFromPull({
      isLoggedIn: true,
      trustLocalDuringCooldown: true,
      localOrder: ['cpap-mask', 'generated-app-1'],
      localCustomized: true,
      serverOrder: ['mypage'],
      serverCustomized: true,
    })).toEqual({ order: ['cpap-mask', 'generated-app-1'], customized: true });
  });

  it('mergeMainAppOrderFromPull returns default layout when neither side is customized', () => {
    expect(mergeMainAppOrderFromPull({
      isLoggedIn: true,
      trustLocalDuringCooldown: false,
      localOrder: [],
      localCustomized: false,
      serverOrder: null,
      serverCustomized: null,
    })).toEqual({ order: [], customized: false });
  });

  it('materializeOrderForMutation appends to visible grid when order is empty and not customized', () => {
    const visible = [{ id: 'cpap-mask' }, { id: 'mypage' }] as const;
    expect(
      materializeOrderForMutation([], [...visible], ids => [...ids, 'generated-app-9'], false),
    ).toEqual(['cpap-mask', 'mypage', 'generated-app-9']);
  });

  it('materializeOrderForMutation keeps empty order when customized', () => {
    const visible = [{ id: 'cpap-mask' }, { id: 'mypage' }] as const;
    expect(
      materializeOrderForMutation([], [...visible], ids => [...ids, 'generated-app-9'], true),
    ).toEqual(['generated-app-9']);
  });

  it('resolveMainAppsFromOrder shows default grid when not customized', () => {
    expect(resolveMainAppsFromOrder([], [], [], false).map(app => app.id)).toEqual([
      createAppShellMetadata.id,
      ...APPS.map(app => app.id),
    ]);
  });

  it('resolveMainAppsFromOrder rehydrates left-panel drag target from catalog by id', () => {
    const generated = {
      id: 'generated-app-7',
      name: '양압기 관리방법',
      description: 'AI 생성',
      icon: 'sparkles',
      gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
      category: 'user' as const,
      source: 'user-created' as const,
      metadata: { generatedServerId: 7, tier: 'standard', isShared: false },
    };

    const main = resolveMainAppsFromOrder(['hospital-info', 'generated-app-7'], [generated], [], true);
    expect(main.map(app => app.id)).toEqual(['hospital-info', 'generated-app-7']);
    expect(main[0]?.icon).toBe('hospital');
    expect(main[1]?.metadata).toEqual(generated.metadata);
  });

  it('resolveMainAppsFromOrder roundtrips empty customized grid after drag-add', () => {
    const afterAdd = resolveMainAppsFromOrder(['hospital-info'], [], [], true);
    expect(afterAdd.map(app => app.id)).toEqual(['hospital-info']);
    expect(afterAdd[0]?.description).toContain('병원');
  });

  it('resolveMainAppsFromOrder shows empty grid when customized with empty order', () => {
    const owned = {
      id: 'generated-app-1',
      name: 'Owned',
      description: '',
      icon: 'magic',
      gradient: 'linear-gradient(#000,#111)',
      category: 'user' as const,
      source: 'user-created' as const,
    };
    expect(resolveMainAppsFromOrder([], [owned], [], true)).toEqual([]);
  });

  it('pruneStaleGeneratedAppOrderIds drops deleted generated-app ids', () => {
    const library = [{
      id: 'generated-app-1',
      name: 'One',
      description: '',
      icon: 'sparkles',
      gradient: 'linear-gradient(135deg,#000,#111)',
      category: 'user' as const,
      source: 'user-created' as const,
    }];
    expect(pruneStaleGeneratedAppOrderIds(
      ['cpap-mask', 'generated-app-1', 'generated-app-2'],
      library,
    )).toEqual(['cpap-mask', 'generated-app-1']);
  });
});
