import React from 'react';
import { useMoaUserProfileSocialActions } from '../../hooks/useMoaUserProfileSocialActions';
import { useMoabomShellT } from '../../i18n/MoabomUiI18nProvider';
import { Button } from '../basic/Button';
import { Span } from '../basic/Span';

export interface MoaUserProfileActionsProps {
  userUuid?: string;
  displayName?: string;
}

export const Moa_UserProfileActions: React.FC<MoaUserProfileActionsProps> = ({
  userUuid,
  displayName,
}) => {
  const { t } = useMoabomShellT();
  const {
    isSelf,
    blocked,
    busy,
    busyChat,
    busyBlock,
    friendButtonLabel,
    friendButtonDisabled,
    friendButtonVariant,
    handleFriend,
    handleChat,
    handleBlockToggle,
  } = useMoaUserProfileSocialActions(userUuid, displayName);

  if (!userUuid || isSelf) {
    return null;
  }

  return (
    <Span className="inline-flex flex-wrap gap-2 rounded-2xl">
      <Button
        type="button"
        variant={friendButtonVariant}
        size="xs"
        className="rounded-xl"
        disabled={friendButtonDisabled}
        onClick={handleFriend}
        aria-pressed={friendButtonVariant === 'danger'}
      >
        {friendButtonLabel}
      </Button>
      <Button
        type="button"
        variant="dark-outline"
        size="xs"
        className="rounded-xl border-0"
        disabled={busy || busyChat}
        onClick={handleChat}
      >
        {t('moa_profile_actions.chat')}
      </Button>
      <Button
        type="button"
        variant={blocked ? 'danger' : 'danger-outline'}
        size="xs"
        className="rounded-xl"
        disabled={busy || busyBlock}
        onClick={handleBlockToggle}
        aria-pressed={blocked}
      >
        {blocked ? t('moa_profile_actions.chat_block_on') : t('moa_profile_actions.chat_block_off')}
      </Button>
    </Span>
  );
};
