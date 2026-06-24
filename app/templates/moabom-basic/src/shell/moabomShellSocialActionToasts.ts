import {
  MoabomShellAuthExpiredError,
  MoabomShellAuthRequiredError,
  MoabomShellModuleApiError,
} from '../api/moabomShellHttp';
import { MoabomChatApiError } from '../api/moabomChatApi';

export type SocialActionKind = 'friend' | 'chat' | 'block';

const CHAT_REJECTED_REASONS = new Set([
  'chat_request_rejected',
  'blocked_by_peer',
  'blocked_by_self',
  'peer_blocked',
  'self_blocked',
]);

export function resolveChatReasonToastKey(reason?: string | null): string {
  switch (reason?.trim()) {
    case 'blocked_by_self':
    case 'self_blocked':
      return 'moa_chat.toast_blocked_by_self';
    case 'blocked_by_peer':
    case 'peer_blocked':
      return 'moa_chat.toast_blocked_by_peer';
    case 'chat_request_rejected':
      return 'moa_chat.toast_request_rejected';
    default:
      return 'moa_chat.toast_request_rejected';
  }
}

export function isFriendshipAlreadyExistsError(error: unknown): boolean {
  return error instanceof MoabomShellModuleApiError
    && error.reason === 'friendship_already_exists';
}

export function resolveSocialActionToastKey(error: unknown, action: SocialActionKind): string {
  if (error instanceof MoabomShellAuthRequiredError || error instanceof MoabomShellAuthExpiredError) {
    return 'moa_chat.toast_login_required';
  }

  const reason = error instanceof MoabomShellModuleApiError || error instanceof MoabomChatApiError
    ? error.reason
    : undefined;

  if (reason && CHAT_REJECTED_REASONS.has(reason)) {
    return resolveChatReasonToastKey(reason);
  }

  if (error instanceof MoabomShellModuleApiError) {
    if (action === 'friend' && isFriendshipAlreadyExistsError(error)) {
      return 'userinfo.friend_request_pending';
    }
  }

  if (action === 'friend') {
    return 'userinfo.friend_request_failed';
  }

  return 'moa_chat.toast_failed';
}

export function resolveChatEligibilityToastKey(eligibility: { can_chat: boolean; reason?: string | null }): string | null {
  if (eligibility.can_chat) {
    return null;
  }
  return resolveChatReasonToastKey(eligibility.reason);
}
