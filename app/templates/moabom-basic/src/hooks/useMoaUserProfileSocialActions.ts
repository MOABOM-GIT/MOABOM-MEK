import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  profileSocialBlockUser,
  profileSocialFetchBlocks,
  profileSocialFetchEligibility,
  profileSocialRemoveFriend,
  profileSocialRequestFriend,
  profileSocialUnblockUser,
} from '../api/moabomProfileSocialApi';
import { getShellAccessToken } from '../api/moabomShellAccess';
import { useMoabomShellT } from '../i18n/MoabomUiI18nProvider';
import { pushConfirmToast } from '../runtime/moabomActionToasts';
import { setMoabomShellPendingChatNavigation } from '../runtime/moabomShellPendingChatNavigation';
import { pushInfoToast, pushWarningToast } from '../runtime/moaShellToasts';
import {
  isFriendshipAlreadyExistsError,
  resolveChatEligibilityToastKey,
  resolveSocialActionToastKey,
} from '../shell/moabomShellSocialActionToasts';
import { getMoaShellBoardBridge } from '../shell/moaShellBoardBridge';
import {
  notifyMoabomShellChatBlockChanged,
  subscribeMoabomShellChatBlockChanged,
} from '../shell/moabomShellChatBlockSync';
import { notifyMoabomPresenceFriendsChanged } from '../shell/moabomPresenceFriendsSync';
import { getShellAuthUserUuid } from '../utils/presenceSettingsSync';
import { useMoabomPresenceContextOptional } from './MoabomPresenceProvider';

export type ProfileFriendshipUiState = 'none' | 'pending' | 'accepted' | 'incoming';

export function useMoaUserProfileSocialActions(userUuid?: string, displayName?: string) {
  const { t } = useMoabomShellT();
  const presence = useMoabomPresenceContextOptional();
  const [blocked, setBlocked] = useState(false);
  const [friendState, setFriendState] = useState<ProfileFriendshipUiState>('none');
  const [busyFriend, setBusyFriend] = useState(false);
  const [busyChat, setBusyChat] = useState(false);
  const [busyBlock, setBusyBlock] = useState(false);

  const isSelf = Boolean(userUuid && getShellAuthUserUuid() === userUuid);
  const busy = busyFriend || busyChat || busyBlock;
  const peerDisplayName = displayName?.trim() || t('moa_chat.unknown_sender');

  useEffect(() => {
    if (!userUuid || !presence) {
      return;
    }

    if (presence.friends.some(friend => friend.user_uuid === userUuid)) {
      setFriendState('accepted');
      return;
    }

    const online = presence.onlineUsers.find(row => row.user_uuid === userUuid);
    if (online?.friendship === 'accepted') {
      setFriendState('accepted');
    } else if (online?.friendship === 'outgoing_pending') {
      setFriendState('pending');
    } else if (online?.friendship === 'incoming_pending') {
      setFriendState('incoming');
    } else {
      setFriendState('none');
    }
  }, [presence, userUuid]);

  useEffect(() => {
    if (!userUuid || !getShellAccessToken()) {
      setBlocked(false);
      return;
    }

    void profileSocialFetchBlocks()
      .then(blocks => setBlocked(blocks.some(item => item.user_uuid === userUuid)))
      .catch(() => setBlocked(false));
  }, [userUuid]);

  useEffect(() => {
    if (!userUuid) {
      return undefined;
    }
    return subscribeMoabomShellChatBlockChanged(detail => {
      if (detail.userUuid === userUuid) {
        setBlocked(detail.blocked);
      }
    });
  }, [userUuid]);

  const ensureUser = useCallback((): string | null => {
    if (!userUuid) {
      return null;
    }
    if (!getShellAccessToken()) {
      pushWarningToast(t('moa_chat.toast_login_required'), 3000);
      return null;
    }
    return userUuid;
  }, [t, userUuid]);

  const openProfileChatTab = useCallback((uuid: string) => {
    setMoabomShellPendingChatNavigation({
      peerUserUuid: uuid,
      conversationUuid: null,
      eligibilityVerified: true,
    });
    getMoaShellBoardBridge()?.openUserProfile?.(uuid, 'chat', {
      shellPath: `/users/${encodeURIComponent(uuid)}/chat`,
      replace: true,
    });
  }, []);

  const refreshFriendState = useCallback(async () => {
    if (presence) {
      await Promise.all([presence.refreshOnline(), presence.refreshFriends()]);
    }
  }, [presence]);

  const removeFriendship = useCallback(async (uuid: string) => {
    setBusyFriend(true);
    try {
      await profileSocialRemoveFriend(uuid);
      setFriendState('none');
      notifyMoabomPresenceFriendsChanged();
      await refreshFriendState();
      pushInfoToast(t('moa_profile_actions.friend_removed_toast', { name: peerDisplayName }), 2800);
    } catch (error) {
      pushWarningToast(t(resolveSocialActionToastKey(error, 'friend')), 3200);
    } finally {
      setBusyFriend(false);
    }
  }, [peerDisplayName, refreshFriendState, t]);

  const cancelFriendRequest = useCallback(async (uuid: string) => {
    setBusyFriend(true);
    try {
      await profileSocialRemoveFriend(uuid);
      setFriendState('none');
      notifyMoabomPresenceFriendsChanged();
      await refreshFriendState();
      pushInfoToast(t('moa_profile_actions.friend_request_cancelled', { name: peerDisplayName }), 2800);
    } catch (error) {
      pushWarningToast(t(resolveSocialActionToastKey(error, 'friend')), 3200);
    } finally {
      setBusyFriend(false);
    }
  }, [peerDisplayName, refreshFriendState, t]);

  const handleFriend = useCallback(async () => {
    const uuid = ensureUser();
    if (!uuid) {
      return;
    }

    if (friendState === 'pending') {
      pushConfirmToast({
        message: t('moa_profile_actions.friend_request_cancel_confirm', { name: peerDisplayName }),
        confirmLabel: t('moa_profile_actions.toast_confirm_yes'),
        onConfirm: () => {
          void cancelFriendRequest(uuid);
        },
      });
      return;
    }

    if (friendState === 'accepted') {
      pushConfirmToast({
        message: t('moa_profile_actions.friend_remove_confirm'),
        confirmLabel: t('moa_profile_actions.toast_confirm_yes'),
        onConfirm: () => {
          void removeFriendship(uuid);
        },
      });
      return;
    }

    setBusyFriend(true);
    try {
      await profileSocialRequestFriend(uuid);
      if (presence) {
        await refreshFriendState();
      } else {
        setFriendState('pending');
      }
    } catch (error) {
      if (isFriendshipAlreadyExistsError(error)) {
        setFriendState('pending');
        return;
      }
      pushWarningToast(t(resolveSocialActionToastKey(error, 'friend')), 3200);
    } finally {
      setBusyFriend(false);
    }
  }, [cancelFriendRequest, ensureUser, friendState, peerDisplayName, presence, refreshFriendState, removeFriendship, t]);

  const handleChat = useCallback(async () => {
    const uuid = ensureUser();
    if (!uuid) {
      return;
    }

    setBusyChat(true);
    try {
      const eligibility = await profileSocialFetchEligibility(uuid);
      const rejectionKey = resolveChatEligibilityToastKey(eligibility);
      if (rejectionKey) {
        pushWarningToast(t(rejectionKey), 3500);
        return;
      }
      openProfileChatTab(uuid);
    } catch (error) {
      pushWarningToast(t(resolveSocialActionToastKey(error, 'chat')), 3200);
    } finally {
      setBusyChat(false);
    }
  }, [ensureUser, openProfileChatTab, t]);

  const handleBlockToggle = useCallback(async () => {
    const uuid = ensureUser();
    if (!uuid) {
      return;
    }

    setBusyBlock(true);
    try {
      if (blocked) {
        await profileSocialUnblockUser(uuid);
        setBlocked(false);
        notifyMoabomShellChatBlockChanged(uuid, false);
        pushInfoToast(t('moa_profile_actions.chat_unblocked'), 2400);
      } else {
        await profileSocialBlockUser(uuid);
        setBlocked(true);
        notifyMoabomShellChatBlockChanged(uuid, true);
        pushWarningToast(t('moa_profile_actions.chat_blocked'), 2400);
      }
    } catch (error) {
      pushWarningToast(t(resolveSocialActionToastKey(error, 'block')), 3200);
    } finally {
      setBusyBlock(false);
    }
  }, [blocked, ensureUser, t]);

  const friendButtonLabel = useMemo(() => {
    if (friendState === 'accepted') {
      return t('moa_profile_actions.friend_remove');
    }
    if (friendState === 'pending') {
      return t('userinfo.friend_request_pending');
    }
    return t('moa_profile_actions.friend_add');
  }, [friendState, t]);

  const friendButtonDisabled = busy;
  const friendButtonVariant = friendState === 'accepted' ? 'danger' : 'primary-outline';

  return {
    isSelf,
    blocked,
    friendState,
    busy,
    busyFriend,
    busyChat,
    busyBlock,
    friendButtonLabel,
    friendButtonDisabled,
    friendButtonVariant,
    handleFriend,
    handleChat,
    handleBlockToggle,
  };
}
