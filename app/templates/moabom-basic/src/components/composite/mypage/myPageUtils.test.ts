import { describe, expect, it } from 'vitest';
import type { MoabomTranslateFn } from '../../../i18n/moabomT';
import { derivePointPresetChoices, GUEST_ENABLED_TABS, TAB_DEFINITIONS } from './myPageConstants';
import {
  reconcileMyPageTabFromShell,
  resolveMypageTabField,
} from './myPageUtils';

const FALLBACK_TAB_STRUCTURE = TAB_DEFINITIONS.map(tab => ({
  id: tab.id,
  guestEnabled: GUEST_ENABLED_TABS.includes(tab.id),
}));

describe('reconcileMyPageTabFromShell', () => {
  it('게스트는 허용 탭이 아니면 settings 로 병합한다', () => {
    expect(reconcileMyPageTabFromShell('credit', false, FALLBACK_TAB_STRUCTURE)).toBe('settings');
  });

  it('로그인 상태에서 부모 탭이 메뉴에 있으면 그대로 둔다', () => {
    expect(reconcileMyPageTabFromShell('credit', true, FALLBACK_TAB_STRUCTURE)).toBe('credit');
  });

  it('메뉴에서 숨겨진 탭은 첫 허용 탭으로 떨어진다', () => {
    const onlyProfile = [{ id: 'profile' as const, guestEnabled: false }];
    expect(reconcileMyPageTabFromShell('settings', true, onlyProfile)).toBe('profile');
  });

  it('서버 메뉴가 빈 배열이면 settings 를 폴백한다', () => {
    expect(reconcileMyPageTabFromShell('profile', true, [])).toBe('settings');
  });
});

describe('derivePointPresetChoices', () => {
  it('서버 목록이 없으면 기본 라벨이 있는 프리셋을 반환한다', () => {
    const rows = derivePointPresetChoices(undefined);
    expect(rows.length).toBe(9);
    expect(rows[0]?.presetId).toBe('main');
    expect(rows[0]?.hex).toBe('#6366f1');
  });

  it('빈 배열은 기본 프리셋으로 폴백한다', () => {
    expect(derivePointPresetChoices([])).toHaveLength(9);
  });

  it('서버 문자열 배열이 오면 레이블 없이 hex 목록으로 변환한다', () => {
    const rows = derivePointPresetChoices(['#aaaaaa']);
    expect(rows).toEqual([{ presetId: null, hex: '#aaaaaa' }]);
  });
});

describe('resolveMypageTabField', () => {
  it('번역이 있으면 번역을 쓰고, 빈 문자열이면 서버 설명으로 넘긴다', () => {
    const t: MoabomTranslateFn = (key: string) => {
      if (key === 'moa_mypage.tabs.credit.desc') {
        return '';
      }
      if (key === 'moa_mypage.tabs.credit.label') {
        return '크레딧';
      }
      return key;
    };
    expect(resolveMypageTabField(t, 'credit', 'desc', '서버 설명')).toBe('서버 설명');
    expect(resolveMypageTabField(t, 'credit', 'label')).toBe('크레딧');
  });

  it('번역 키 미해결 시 서버값이 없으면 코어 문자열을 그대로 반환한다', () => {
    const t: MoabomTranslateFn = key => key;
    expect(resolveMypageTabField(t, 'profile', 'label', null)).toBe('moa_mypage.tabs.profile.label');
  });
});
