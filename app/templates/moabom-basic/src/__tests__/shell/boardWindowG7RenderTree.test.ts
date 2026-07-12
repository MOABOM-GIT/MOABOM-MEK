import { describe, expect, it, afterEach } from 'vitest';
import {
  isBoardWindowModalDef,
  mergeBoardWindowLiveGlobalState,
  splitBoardWindowComponentDefs,
} from '../../shell/boardWindowG7RenderTree';

describe('boardWindowG7RenderTree', () => {
  afterEach(() => {
    delete (window as { __templateApp?: unknown }).__templateApp;
    delete (window as { G7Core?: unknown }).G7Core;
  });

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
    (window as { G7Core?: unknown }).G7Core = {
      AuthManager: {
        getInstance: () => ({
          getUser: () => ({ uuid: 'u1', name: '테스터' }),
        }),
      },
    };
    (window as { __templateApp?: { getGlobalState?: () => Record<string, unknown> } }).__templateApp = {
      getGlobalState: () => ({
        modalStack: ['board_delete_modal'],
        activeModal: 'board_delete_modal',
        deleteModal: { type: 'post', isGuest: false },
      }),
    };

    const merged = mergeBoardWindowLiveGlobalState({
      post: { data: { title: '공지' } },
      _global: { currentUser: { uuid: 'stale' } },
    });

    const global = merged._global as Record<string, unknown>;
    expect(global.modalStack).toEqual(['board_delete_modal']);
    expect(global.deleteModal).toEqual({ type: 'post', isGuest: false });
    expect(global.currentUser).toMatchObject({ uuid: 'u1', name: '테스터' });
  });

  it('mergeBoardWindowLiveGlobalState 는 uuid 없는 live currentUser 를 AuthManager 로 보정한다', () => {
    (window as { G7Core?: unknown }).G7Core = {
      AuthManager: {
        getInstance: () => ({
          getUser: () => ({
            uuid: '22222222-2222-4222-8222-222222222222',
            name: '회원',
            avatar: '/a.png',
          }),
        }),
      },
    };
    (window as { __templateApp?: { getGlobalState?: () => Record<string, unknown> } }).__templateApp = {
      getGlobalState: () => ({
        currentUser: { name: '회원', level: 1, point: 0 },
      }),
    };

    const merged = mergeBoardWindowLiveGlobalState({
      _global: {},
    });

    expect((merged._global as Record<string, unknown>).currentUser).toMatchObject({
      uuid: '22222222-2222-4222-8222-222222222222',
      name: '회원',
    });
  });
});
