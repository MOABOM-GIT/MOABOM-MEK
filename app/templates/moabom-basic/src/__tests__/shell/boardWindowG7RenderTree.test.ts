import { describe, expect, it } from 'vitest';
import {
  isBoardWindowModalDef,
  mergeBoardWindowLiveGlobalState,
  splitBoardWindowComponentDefs,
} from '../../shell/boardWindowG7RenderTree';

describe('boardWindowG7RenderTree', () => {
  it('splitBoardWindowComponentDefs 는 Modal id 를 모달로 분리한다', () => {
    const toast = { id: 'global_toast', type: 'composite', name: 'Toast' };
    const body = { type: 'layout', name: 'Container' };
    const deleteModal = {
      id: 'board_delete_modal',
      type: 'composite',
      name: 'Modal',
    };

    const { contentDefs, modalDefs } = splitBoardWindowComponentDefs([toast, body, deleteModal]);

    expect(contentDefs).toHaveLength(2);
    expect(modalDefs).toHaveLength(1);
    expect(modalDefs[0]?.id).toBe('board_delete_modal');
    expect(isBoardWindowModalDef(deleteModal)).toBe(true);
    expect(isBoardWindowModalDef(toast)).toBe(false);
  });

  it('mergeBoardWindowLiveGlobalState 는 TemplateApp 전역 modalStack 을 반영한다', () => {
    const priorApp = (window as { __templateApp?: unknown }).__templateApp;
    (window as { __templateApp?: { getGlobalState?: () => Record<string, unknown> } }).__templateApp = {
      getGlobalState: () => ({
        modalStack: ['board_delete_modal'],
        activeModal: 'board_delete_modal',
        deleteModal: { type: 'post', isGuest: false },
      }),
    };

    try {
      const merged = mergeBoardWindowLiveGlobalState({
        post: { data: { title: '공지' } },
        _global: { currentUser: { uuid: 'u1' } },
      });

      const global = merged._global as Record<string, unknown>;
      expect(global.modalStack).toEqual(['board_delete_modal']);
      expect(global.deleteModal).toEqual({ type: 'post', isGuest: false });
      expect(global.currentUser).toEqual({ uuid: 'u1' });
    } finally {
      (window as { __templateApp?: unknown }).__templateApp = priorApp;
    }
  });
});
