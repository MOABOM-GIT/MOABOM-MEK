import React from 'react';
import type { MoabomTranslateFn } from '../../../i18n/moabomT';
import type { PresenceAvailability, PresenceSubtitleMode } from '../../../api/moabomPresenceApi';
import { Button } from '../../basic/Button';
import { Div } from '../../basic/Div';
import { Span } from '../../basic/Span';
import { MY_PAGE_BLOCK_TITLE_CLASS } from './myPageStyles';
import AppLoadingSpinner from '../AppLoadingSpinner';

const ToggleIndicator: React.FC<{ active: boolean }> = ({ active }) => (
  <Span
    className={`relative h-6 w-11 rounded-full transition-colors ${active ? '' : 'bg-slate-300 dark:bg-slate-600'}`}
    style={active ? { background: 'var(--moa-point-color)' } : undefined}
  >
    <Span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-[left] ${active ? 'left-6' : 'left-1'}`} />
  </Span>
);

const AVAILABILITY_OPTIONS: PresenceAvailability[] = ['online', 'away', 'busy', 'offline'];
const SUBTITLE_OPTIONS: PresenceSubtitleMode[] = ['profile_bio', 'activity', 'hidden'];

export interface Moa_MyPagePresenceSettingsSectionProps {
  t: MoabomTranslateFn;
  availability: PresenceAvailability;
  setAvailability: (value: PresenceAvailability) => void;
  subtitleMode: PresenceSubtitleMode;
  setSubtitleMode: (value: PresenceSubtitleMode) => void;
  showAvatarInConnectList: boolean;
  setShowAvatarInConnectList: (value: boolean) => void;
  acceptChatRequests: boolean;
  setAcceptChatRequests: (value: boolean) => void;
  loading: boolean;
  saving: boolean;
  error: string | null;
  disabled: boolean;
}

export const Moa_MyPagePresenceSettingsSection: React.FC<Moa_MyPagePresenceSettingsSectionProps> = ({
  t,
  availability,
  setAvailability,
  subtitleMode,
  setSubtitleMode,
  showAvatarInConnectList,
  setShowAvatarInConnectList,
  acceptChatRequests,
  setAcceptChatRequests,
  loading,
  saving,
  error,
  disabled,
}) => {
  if (loading) {
    return <AppLoadingSpinner label={t('moa_mypage.presence.loading')} />;
  }

  return (
    <>
      {error ? (
        <Div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </Div>
      ) : null}

      <Div className="moa-mypage-presence-toggles grid grid-cols-1 gap-2">
        <Button
          type="button"
          variant="dark-outline"
          size="medium"
          className="moa-mypage-presence-toggle-btn w-full"
          style={{ justifyContent: 'space-between' }}
          disabled={disabled || saving}
          onClick={() => setShowAvatarInConnectList(!showAvatarInConnectList)}
        >
          <Span className="moa-mypage-presence-toggle-label flex-1 text-left">
            {t('moa_mypage.presence.show_avatar_in_connect_label')}
          </Span>
          <ToggleIndicator active={showAvatarInConnectList} />
        </Button>

        <Button
          type="button"
          variant="dark-outline"
          size="medium"
          className="moa-mypage-presence-toggle-btn w-full"
          style={{ justifyContent: 'space-between' }}
          disabled={disabled || saving}
          onClick={() => setAcceptChatRequests(!acceptChatRequests)}
        >
          <Span className="moa-mypage-presence-toggle-label flex-1 text-left">
            {t('moa_mypage.presence.accept_chat_requests_label')}
          </Span>
          <ToggleIndicator active={acceptChatRequests} />
        </Button>
      </Div>

      <Div>
        <Span className={`block ${MY_PAGE_BLOCK_TITLE_CLASS}`}>{t('moa_mypage.presence.availability_title')}</Span>
        <Div className="moa-mypage-presence-availability grid grid-cols-4 gap-2">
          {AVAILABILITY_OPTIONS.map(option => (
            <Button
              key={option}
              type="button"
              variant={availability === option ? 'primary' : 'dark-outline'}
              size="medium"
              className="justify-start"
              disabled={disabled || saving}
              onClick={() => setAvailability(option)}
            >
              <Span className={`inline-block h-2.5 w-2.5 rounded-full mr-2 moa-status-dot-static moa-status-${option === 'online' ? 'online' : option === 'busy' ? 'busy' : option === 'away' ? 'away' : 'offline'}`} />
              {t(`moa_mypage.presence.availability_${option}`)}
            </Button>
          ))}
        </Div>
      </Div>

      <Div>
        <Span className={`block ${MY_PAGE_BLOCK_TITLE_CLASS}`}>{t('moa_mypage.presence.subtitle_title')}</Span>
        <Div className="moa-mypage-presence-subtitle grid grid-cols-3 gap-2">
          {SUBTITLE_OPTIONS.map(option => (
            <Button
              key={option}
              type="button"
              variant={subtitleMode === option ? 'primary' : 'dark-outline'}
              size="medium"
              className="justify-start"
              disabled={disabled || saving}
              onClick={() => setSubtitleMode(option)}
            >
              {t(`moa_mypage.presence.subtitle_${option}`)}
            </Button>
          ))}
        </Div>
      </Div>
    </>
  );
};
