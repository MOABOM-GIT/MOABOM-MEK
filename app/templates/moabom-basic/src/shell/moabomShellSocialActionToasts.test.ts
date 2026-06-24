import { describe, expect, it } from 'vitest';

import { MoabomShellModuleApiError } from '../api/moabomShellHttp';
import {
  isFriendshipAlreadyExistsError,
  resolveChatEligibilityToastKey,
  resolveSocialActionToastKey,
} from './moabomShellSocialActionToasts';

describe('moabomShellSocialActionToasts', () => {
  it('maps friendship_already_exists to pending toast', () => {
    const error = new MoabomShellModuleApiError(422, 'already', {
      success: false,
      errors: { reason: 'friendship_already_exists' },
    });

    expect(isFriendshipAlreadyExistsError(error)).toBe(true);
    expect(resolveSocialActionToastKey(error, 'friend')).toBe('userinfo.friend_request_pending');
  });

  it('maps chat rejected reason to request rejected toast', () => {
    const error = new MoabomShellModuleApiError(422, 'rejected', {
      success: false,
      errors: { reason: 'chat_request_rejected' },
    });

    expect(resolveSocialActionToastKey(error, 'chat')).toBe('moa_chat.toast_request_rejected');
  });

  it('maps eligibility can_chat false to rejection toast', () => {
    expect(resolveChatEligibilityToastKey({ can_chat: false, reason: 'chat_request_rejected' }))
      .toBe('moa_chat.toast_request_rejected');
    expect(resolveChatEligibilityToastKey({ can_chat: false, reason: 'blocked_by_self' }))
      .toBe('moa_chat.toast_blocked_by_self');
    expect(resolveChatEligibilityToastKey({ can_chat: true })).toBeNull();
  });

  it('falls back to generic failure keys', () => {
    const error = new MoabomShellModuleApiError(500, 'fail', { success: false });
    expect(resolveSocialActionToastKey(error, 'friend')).toBe('userinfo.friend_request_failed');
    expect(resolveSocialActionToastKey(error, 'block')).toBe('moa_chat.toast_failed');
  });
});
