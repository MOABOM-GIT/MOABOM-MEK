import { describe, expect, it } from 'vitest';
import {
  extractServerMainAppOrder,
  mergeMainAppOrderFromPull,
  materializeOrderForMutation,
  sanitizeMainAppOrderIds,
} from './moaHomeShellOrder';

describe('moaHomeShellOrder', () => {
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

  it('mergeMainAppOrderFromPull prefers server order for logged-in users', () => {
    expect(mergeMainAppOrderFromPull({
      isLoggedIn: true,
      trustLocalDuringCooldown: false,
      localOrder: ['cpap-mask'],
      serverOrder: ['generated-app-42', 'mypage'],
    })).toEqual(['generated-app-42', 'mypage']);
  });

  it('mergeMainAppOrderFromPull keeps local order during save cooldown', () => {
    expect(mergeMainAppOrderFromPull({
      isLoggedIn: true,
      trustLocalDuringCooldown: true,
      localOrder: ['cpap-mask', 'generated-app-1'],
      serverOrder: ['mypage'],
    })).toEqual(['cpap-mask', 'generated-app-1']);
  });

  it('materializeOrderForMutation appends to visible grid when order is empty', () => {
    const visible = [{ id: 'cpap-mask' }, { id: 'mypage' }] as const;
    expect(
      materializeOrderForMutation([], [...visible], ids => [...ids, 'generated-app-9']),
    ).toEqual(['cpap-mask', 'mypage', 'generated-app-9']);
  });
});
