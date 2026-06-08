import { describe, expect, it } from 'vitest';
import type { MoabomSystemMenuConfig } from '../../../types/moabomSystem';
import { buildMyPageSidebarTabs, buildMyPageTabStructureForRouting } from './myPageMenuModel';

const t = (key: string) => key;

function testMenu(
  overrides: Partial<MoabomSystemMenuConfig> &
    Pick<MoabomSystemMenuConfig, 'id' | 'enabled' | 'guest_enabled' | 'order'>,
): MoabomSystemMenuConfig {
  return {
    label: 'Label',
    description: 'Description',
    icon: 'circle',
    ...overrides,
  };
}

describe('myPageMenuModel', () => {
  it('falls back to TAB_DEFINITIONS when server menus are empty', () => {
    const structure = buildMyPageTabStructureForRouting(undefined);
    expect(structure.map(row => row.id)).toEqual([
      'profile',
      'settings',
      'credit',
      'library',
      'activity',
      'account',
      'subscription',
    ]);
    expect(structure.find(row => row.id === 'library')?.guestEnabled).toBe(true);
  });

  it('respects admin menu enabled/order/guest flags', () => {
    const structure = buildMyPageTabStructureForRouting([
      testMenu({ id: 'library', label: 'Lib', enabled: true, guest_enabled: true, order: 10 }),
      testMenu({ id: 'profile', label: 'Me', enabled: false, guest_enabled: false, order: 5 }),
      testMenu({ id: 'settings', label: 'Set', enabled: true, guest_enabled: true, order: 20 }),
      testMenu({ id: 'unknown', label: 'X', enabled: true, guest_enabled: true, order: 30 }),
    ]);

    expect(structure.map(row => row.id)).toEqual(['library', 'settings']);
    const tabs = buildMyPageSidebarTabs(t, [
      testMenu({
        id: 'library',
        label: 'Server Lib',
        description: 'Desc',
        icon: 'folder',
        enabled: true,
        guest_enabled: true,
        order: 10,
      }),
      testMenu({
        id: 'settings',
        label: 'Server Set',
        description: 'Desc2',
        enabled: true,
        guest_enabled: true,
        order: 20,
      }),
    ]);
    expect(tabs[0]?.label).toBe('Server Lib');
    expect(tabs[0]?.icon).toBe('folder');
  });
});
