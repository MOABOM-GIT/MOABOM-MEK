import React from 'react';
import type { MoabomTranslateFn } from '../../../i18n/moabomT';
import type { PresenceAvailability, PresenceSubtitleMode } from '../../../api/moabomPresenceApi';
import { Button } from '../../basic/Button';
import { Div } from '../../basic/Div';
import { Span } from '../../basic/Span';
import { APP_STACK_CLASS } from '../../../apps/appShellTypography';
import { MY_PAGE_BLOCK_TITLE_CLASS } from './myPageStyles';

const AVAILABILITY_OPTIONS: PresenceAvailability[] = ['online', 'away', 'busy', 'offline'];
const SUBTITLE_OPTIONS: PresenceSubtitleMode[] = ['profile_bio', 'activity', 'hidden'];

export interface Moa_MyPagePresenceSettingsSectionProps {
  t: MoabomTranslateFn;
  availability: PresenceAvailability;
  setAvailability: (value: PresenceAvailability) => void;
  subtitleMode: PresenceSubtitleMode;
  setSubtitleMode: (value: PresenceSubtitleMode) => void;
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
  loading,
  saving,
  error,
  disabled,
}) => (
  <Div className={`border-t border-white/10 ${APP_STACK_CLASS}`}>
    {loading ? (
      <Span className="text-sm text-muted">{t('moa_mypage.presence.loading')}</Span>
    ) : (
      <>
        {error ? (
          <Div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </Div>
        ) : null}

        <Div className="mb-5">
          <Span className={`mb-2 block ${MY_PAGE_BLOCK_TITLE_CLASS}`}>{t('moa_mypage.presence.availability_title')}</Span>
          <Div className="grid grid-cols-2 gap-2">
            {AVAILABILITY_OPTIONS.map(option => (
              <Button
                key={option}
                type="button"
                variant={availability === option ? 'primary' : 'dark-outline'}
                size="sm"
                className="justify-start"
                disabled={disabled || saving}
                onClick={() => setAvailability(option)}
              >
                <Span className={`inline-block h-2.5 w-2.5 rounded-full mr-2 moa-status-dot-static moa-status-${option === 'online' ? 'online' : option === 'busy' ? 'busy' : option === 'away' ? 'away' : 'offline'}`} />
                {t(`moa_mypage.presence.availability_${option}`)}
              </Button>
            ))}
          </Div>
          <Span className="mt-2 block text-xs text-muted">{t(`moa_mypage.presence.availability_hint_${availability}`)}</Span>
        </Div>

        <Div>
          <Span className={`mb-2 block ${MY_PAGE_BLOCK_TITLE_CLASS}`}>{t('moa_mypage.presence.subtitle_title')}</Span>
          <Div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {SUBTITLE_OPTIONS.map(option => (
              <Button
                key={option}
                type="button"
                variant={subtitleMode === option ? 'primary' : 'dark-outline'}
                size="sm"
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
    )}
  </Div>
);
