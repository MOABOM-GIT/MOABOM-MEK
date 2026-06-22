import React from 'react';
import type { MoabomTranslateFn } from '../../../i18n/moabomT';
import type { MyPageUser } from './myPageTypes';
import { Button } from '../../basic/Button';
import { Div } from '../../basic/Div';
import { Img } from '../../basic/Img';
import { Input } from '../../basic/Input';
import { Span } from '../../basic/Span';
import { Textarea } from '../../basic/Textarea';
import { POINT_COLOR } from './myPageConstants';
import { APP_STACK_CLASS, APP_STACK_GRID_CLASS } from '../../../apps/appShellTypography';
import { Moa_MyPagePresenceSettingsSection } from './Moa_MyPagePresenceSettingsSection';
import type { PresenceAvailability, PresenceSubtitleMode } from '../../../api/moabomPresenceApi';
import { ACTION_BUTTON_VARIANT, GROUP_PANEL, INPUT_SURFACE, MY_PAGE_BLOCK_TITLE_CLASS, TEXTAREA_SURFACE } from './myPageStyles';

export interface Moa_MyPageProfilePanelProps {
  t: MoabomTranslateFn;
  currentUser: MyPageUser | null;
  nickname: string;
  setNickname: (value: string) => void;
  bio: string;
  setBio: (value: string) => void;
  avatarUrl: string;
  avatarInputRef: React.RefObject<HTMLInputElement | null>;
  profileBusy: boolean;
  profileLoading: boolean;
  profileBanner: { text: string } | null;
  profileErr: (field: string) => string;
  userInitial: string;
  profileSaveSubmitting: boolean;
  avatarUploading: boolean;
  onAvatarFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSaveProfile: () => void;
  presence: {
    availability: PresenceAvailability;
    setAvailability: (value: PresenceAvailability) => void;
    subtitleMode: PresenceSubtitleMode;
    setSubtitleMode: (value: PresenceSubtitleMode) => void;
    loading: boolean;
    saving: boolean;
    error: string | null;
  };
}

export const Moa_MyPageProfilePanel: React.FC<Moa_MyPageProfilePanelProps> = ({
  t,
  currentUser,
  nickname,
  setNickname,
  bio,
  setBio,
  avatarUrl,
  avatarInputRef,
  profileBusy,
  profileLoading,
  profileBanner,
  profileErr,
  userInitial,
  profileSaveSubmitting,
  avatarUploading,
  onAvatarFile,
  onSaveProfile,
  presence,
}) => (
  <Div className={`moa-mypage-profile ${APP_STACK_GRID_CLASS} grid grid-cols-[180px_1fr]`}>
    <Div className={`${GROUP_PANEL} p-4 flex flex-col items-center text-center`}>
      {avatarUrl ? (
        <Img
          src={avatarUrl}
          alt={t('moa_mypage.profile.avatar_alt', {
            name: nickname || currentUser?.name || t('moa_mypage.common.user_fallback'),
          })}
          className="h-24 w-24 rounded-full object-cover shadow-xl"
        />
      ) : (
        <Div
          className="w-24 h-24 rounded-full flex items-center justify-center text-white text-4xl font-bold shadow-xl"
          style={{ background: POINT_COLOR }}
        >
          {userInitial}
        </Div>
      )}
      <Input
        ref={avatarInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={(event) => void onAvatarFile(event)}
      />
      <Button
        variant={ACTION_BUTTON_VARIANT}
        size="medium"
        className="mt-4"
        type="button"
        disabled={!currentUser || avatarUploading}
        onClick={() => avatarInputRef.current?.click()}
      >
        {avatarUploading ? t('moa_mypage.profile.image_changing') : t('moa_mypage.profile.image_change')}
      </Button>
      {profileErr('avatar') ? (
        <Span className="mt-2 block text-xs text-red-500">{profileErr('avatar')}</Span>
      ) : null}
    </Div>
    <Div className={`${GROUP_PANEL} p-5 ${APP_STACK_CLASS}`}>
      {profileBanner && (
        <Div className="rounded-xl px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200">
          {profileBanner.text}
        </Div>
      )}

      {profileLoading ? (
        <Span className="text-sm text-muted">{t('moa_mypage.profile.loading')}</Span>
      ) : (
        <>
          <Div className="mb-1">
            <Span className={`block ${MY_PAGE_BLOCK_TITLE_CLASS}`}>{t('moa_mypage.profile.nickname')}</Span>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className={INPUT_SURFACE}
              maxLength={50}
              disabled={profileBusy}
            />
            {profileErr('nickname') ? (
              <Span className="mt-1 block text-xs text-red-500">{profileErr('nickname')}</Span>
            ) : null}
          </Div>
          <Div>
            <Span className={`block ${MY_PAGE_BLOCK_TITLE_CLASS}`}>{t('moa_mypage.profile.bio')}</Span>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className={`${TEXTAREA_SURFACE} min-h-[110px]`}
              maxLength={500}
              disabled={profileBusy}
            />
            {profileErr('bio') ? (
              <Span className="mt-1 block text-xs text-red-500">{profileErr('bio')}</Span>
            ) : null}
          </Div>

          <Moa_MyPagePresenceSettingsSection
            t={t}
            availability={presence.availability}
            setAvailability={presence.setAvailability}
            subtitleMode={presence.subtitleMode}
            setSubtitleMode={presence.setSubtitleMode}
            loading={presence.loading}
            saving={presence.saving}
            error={presence.error}
            disabled={profileBusy}
          />

          <Div className="flex justify-end pt-2">
            <Button
              variant={ACTION_BUTTON_VARIANT}
              size="medium"
              type="button"
              disabled={profileBusy || profileLoading}
              onClick={() => void onSaveProfile()}
            >
              {profileSaveSubmitting ? t('moa_mypage.profile.saving') : t('moa_mypage.profile.save')}
            </Button>
          </Div>
        </>
      )}
    </Div>
  </Div>
);
