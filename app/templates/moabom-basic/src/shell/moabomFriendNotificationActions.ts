import { acceptPresenceFriend } from '../api/moabomPresenceApi';
import type { MoabomTranslateFn } from '../i18n/moabomT';
import { pushConfirmToast } from '../runtime/moabomActionToasts';
import { pushInfoToast, pushWarningToast } from '../runtime/moaShellToasts';
import { notifyMoabomPresenceFriendsChanged } from './moabomPresenceFriendsSync';
import { extractNotificationPath } from '../utils/moabomNotificationNavigateUrl';

const PROFILE_USER_UUID_PATTERN = /^\/users\/([^/?#]+)/i;

export function extractProfileUserUuidFromUrl(url?: string | null): string | null {
  const path = extractNotificationPath(url);
  if (!path || /^https?:\/\//i.test(path)) {
    return null;
  }

  const pathname = path.split(/[?#]/)[0] ?? path;
  const match = pathname.match(PROFILE_USER_UUID_PATTERN);
  if (!match?.[1]) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function resolveFriendRequesterName(
  subject?: string | null,
  body?: string | null,
  data?: Record<string, unknown> | null,
): string | null {
  const fromData = typeof data?.requester_name === 'string' ? data.requester_name.trim() : '';
  if (fromData) {
    return fromData;
  }

  const fromBody = body?.trim() ?? '';
  const bodyMatch = fromBody.match(/^(.+?)님이 친구 요청을 보냈습니다\.?$/);
  if (bodyMatch?.[1]) {
    return bodyMatch[1].trim();
  }

  const subjectTrimmed = subject?.trim();
  return subjectTrimmed || null;
}

export async function acceptFriendRequestFromNotification(options: {
  requesterUuid: string;
  requesterName: string;
  t: MoabomTranslateFn;
  onAccepted?: () => void | Promise<void>;
}): Promise<boolean> {
  const { requesterUuid, requesterName, t, onAccepted } = options;

  try {
    await acceptPresenceFriend(requesterUuid);
    notifyMoabomPresenceFriendsChanged();
    await onAccepted?.();
    pushInfoToast(t('moa_profile_actions.friend_became_toast', { name: requesterName }), 3000);
    return true;
  } catch {
    pushWarningToast(t('moa_shell.right.presence_friend_request_failed'), 3200);
    return false;
  }
}

export function pushFriendAcceptConfirmToast(options: {
  requesterUuid: string;
  requesterName: string;
  t: MoabomTranslateFn;
}): void {
  const { requesterUuid, requesterName, t } = options;
  pushConfirmToast({
    message: t('moa_profile_actions.friend_accept_confirm', { name: requesterName }),
    confirmLabel: t('moa_profile_actions.toast_confirm_yes'),
    type: 'info',
    onConfirm: () => {
      void acceptFriendRequestFromNotification({
        requesterUuid,
        requesterName,
        t,
      });
    },
  });
}
