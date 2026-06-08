import React from 'react';
import type {
  MoabomSystemDefaults,
  MoabomSystemLanguage,
  MoabomSystemState,
} from '../../../types/moabomSystem';
import type { MoabomTranslateFn } from '../../../i18n/moabomT';
import type { App } from '../../../data/Moa_apps';
import {
  deriveMoabomBackgroundImageChoicesByMode,
  moabomThemeToBackgroundMode,
} from '../../../utils/moBackgroundAssets';
import { DEFAULT_MOABOM_SYSTEM } from '../../../utils/moabomSystemStore';
import { derivePointPresetChoices } from './myPageConstants';
import type {
  ActivityItem,
  ActivityOverview,
  CreditOverview,
  MyPageTab,
  MyPageUser,
} from './myPageTypes';
import { themeTranslationKey } from './myPageUtils';
import { Moa_MyPageAccountPanel } from './Moa_MyPageAccountPanel';
import { Moa_MyPageActivityPanel } from './Moa_MyPageActivityPanel';
import { Moa_MyPageCreditPanel } from './Moa_MyPageCreditPanel';
import { Moa_MyPageLibraryPanel } from './Moa_MyPageLibraryPanel';
import { Moa_MyPageProfilePanel } from './Moa_MyPageProfilePanel';
import { MyPageSettingsTab } from './Moa_MyPageSettingsTab';
import { Moa_MyPageSubscriptionPanel } from './Moa_MyPageSubscriptionPanel';

export interface Moa_MyPageTabPanelsProps {
  activeTab: MyPageTab;
  t: MoabomTranslateFn;
  shellLanguage: MoabomSystemLanguage;
  currentUser: MyPageUser | null;
  isGuest: boolean;
  systemDefaults: MoabomSystemDefaults | null;
  systemState: MoabomSystemState;
  onSystemStateChange: (next: MoabomSystemState) => void;
  onOpenApp?: (app: App) => void;
  onEditGeneratedApp?: (serverId: number) => void;
  favoriteApps: App[];
  recentApps: App[];
  profile: {
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
    onSaveProfile: (includeAccountInfo?: boolean) => void;
    profileName: string;
    setProfileName: (value: string) => void;
    profileEmail: string;
    setProfileEmail: (value: string) => void;
    profileMobile: string;
    setProfileMobile: (value: string) => void;
  };
  credit: {
    creditBalance: number;
    creditOverview: CreditOverview | null;
    creditLoading: boolean;
    creditError: string;
    attendanceLoading: boolean;
    attendanceMessage: string;
    onAttendanceCheck: () => void;
  };
  library: {
    createdLibraryApps: App[];
    createdLibraryLoading: boolean;
  };
  activity: {
    activityOverview: ActivityOverview | null;
    activityFilter: string;
    setActivityFilter: (value: string) => void;
    activityLoading: boolean;
    activityError: string;
    onOpenActivity: (item: ActivityItem) => void;
  };
  account: {
    socialProviderLabel: string | null;
    securityPanel: 'none' | 'password' | 'withdraw';
    setSecurityPanel: (panel: 'none' | 'password' | 'withdraw') => void;
    securityCurrentPassword: string;
    setSecurityCurrentPassword: (value: string) => void;
    securityVerified: boolean;
    setSecurityVerified: (value: boolean) => void;
    newPassword: string;
    setNewPassword: (value: string) => void;
    newPasswordConfirmation: string;
    setNewPasswordConfirmation: (value: string) => void;
    securitySubmitting: boolean;
    securityMessage: { type: 'success' | 'error'; text: string } | null;
    setSecurityMessage: (value: { type: 'success' | 'error'; text: string } | null) => void;
    onOpenPasswordPanel: () => void;
    onOpenWithdrawPanel: () => void;
    onVerifySecurityPassword: () => void;
    onChangePassword: () => void;
    onWithdraw: () => void;
  };
}

export const Moa_MyPageTabPanels: React.FC<Moa_MyPageTabPanelsProps> = ({
  activeTab,
  t,
  shellLanguage,
  currentUser,
  isGuest,
  systemDefaults,
  systemState,
  onSystemStateChange,
  onOpenApp,
  onEditGeneratedApp,
  favoriteApps,
  recentApps,
  profile,
  credit,
  library,
  activity,
  account,
}) => {
  if (activeTab === 'profile') {
    return (
      <Moa_MyPageProfilePanel
        t={t}
        currentUser={currentUser}
        nickname={profile.nickname}
        setNickname={profile.setNickname}
        bio={profile.bio}
        setBio={profile.setBio}
        avatarUrl={profile.avatarUrl}
        avatarInputRef={profile.avatarInputRef}
        profileBusy={profile.profileBusy}
        profileLoading={profile.profileLoading}
        profileBanner={profile.profileBanner}
        profileErr={profile.profileErr}
        userInitial={profile.userInitial}
        profileSaveSubmitting={profile.profileSaveSubmitting}
        avatarUploading={profile.avatarUploading}
        onAvatarFile={profile.onAvatarFile}
        onSaveProfile={() => void profile.onSaveProfile()}
      />
    );
  }

  if (activeTab === 'settings') {
    const currentBgMode = moabomThemeToBackgroundMode(systemState.appearance.theme);
    const modeFilteredBgIds = deriveMoabomBackgroundImageChoicesByMode(
      systemDefaults?.appearance,
      currentBgMode,
    );
    const pointColorToBackgroundId: Record<string, string> = {};
    for (const item of systemDefaults?.appearance?.home_background_items ?? []) {
      const hex = typeof item?.point_color === 'string' ? item.point_color.toLowerCase() : null;
      if (!hex || !/^#[0-9a-f]{6}$/.test(hex) || !item?.id) continue;
      if (!(hex in pointColorToBackgroundId) || (item.mode ?? 'light') === currentBgMode) {
        pointColorToBackgroundId[hex] = item.id;
      }
    }

    return (
      <MyPageSettingsTab
        t={t}
        systemState={systemState}
        languages={(systemDefaults?.preferences?.languages ?? [
          { id: 'ko', label: '', enabled: true },
          { id: 'en', label: '', enabled: true },
          { id: 'ja', label: '', enabled: true },
          { id: 'zh', label: '', enabled: true },
        ]).map(item => {
          const key = `moa_mypage.lang_names.${item.id}`;
          const tr = t(key);
          return { ...item, label: tr !== key ? tr : item.label || item.id };
        })}
        themes={(systemDefaults?.appearance?.themes ?? [
          { id: 'light', label: '', enabled: true },
          { id: 'dark', label: '', enabled: true },
          { id: 'flat-light', label: '', enabled: true },
          { id: 'flat-dark', label: '', enabled: true },
        ]).map(item => {
          const tk = themeTranslationKey(item.id);
          const tr = t(tk);
          return { ...item, label: tr !== tk ? tr : item.label || item.id };
        })}
        pointPresetChoices={derivePointPresetChoices(systemDefaults?.appearance?.point_color_presets)}
        backgroundImageIds={modeFilteredBgIds}
        pointColorToBackgroundId={pointColorToBackgroundId}
        systemOptions={(systemDefaults?.preferences?.system_options ?? [
          { id: 'sound', label: '', on_by_default: DEFAULT_MOABOM_SYSTEM.preferences.systemOptions.sound, user_editable: true },
          { id: 'animation', label: '', on_by_default: DEFAULT_MOABOM_SYSTEM.preferences.systemOptions.animation, user_editable: true },
          { id: 'haptic', label: '', on_by_default: DEFAULT_MOABOM_SYSTEM.preferences.systemOptions.haptic, user_editable: true },
          { id: 'toast', label: '', on_by_default: DEFAULT_MOABOM_SYSTEM.preferences.systemOptions.toast, user_editable: true },
          { id: 'weather', label: '', on_by_default: DEFAULT_MOABOM_SYSTEM.preferences.systemOptions.weather, user_editable: true },
        ]).map(opt => {
          const tk = `moa_mypage.system_options.${opt.id}`;
          const tr = t(tk);
          return { ...opt, label: tr !== tk ? tr : opt.label || opt.id };
        })}
        onChange={onSystemStateChange}
      />
    );
  }

  if (activeTab === 'credit') {
    return (
      <Moa_MyPageCreditPanel
        t={t}
        creditBalance={credit.creditBalance}
        creditOverview={credit.creditOverview}
        creditLoading={credit.creditLoading}
        creditError={credit.creditError}
        attendanceLoading={credit.attendanceLoading}
        attendanceMessage={credit.attendanceMessage}
        onAttendanceCheck={credit.onAttendanceCheck}
      />
    );
  }

  if (activeTab === 'library') {
    return (
      <Moa_MyPageLibraryPanel
        t={t}
        locale={shellLanguage}
        isGuest={isGuest}
        onOpenApp={onOpenApp}
        onEditGeneratedApp={onEditGeneratedApp}
        createdApps={library.createdLibraryApps}
        createdAppsLoading={library.createdLibraryLoading}
        favoriteApps={favoriteApps}
        recentApps={recentApps}
      />
    );
  }

  if (activeTab === 'activity') {
    return (
      <Moa_MyPageActivityPanel
        t={t}
        showAdminSessionNotice={!!(currentUser?.is_admin || currentUser?.is_super)}
        activityOverview={activity.activityOverview}
        activityFilter={activity.activityFilter}
        setActivityFilter={activity.setActivityFilter}
        activityLoading={activity.activityLoading}
        activityError={activity.activityError}
        onOpenActivity={activity.onOpenActivity}
      />
    );
  }

  if (activeTab === 'subscription') {
    return <Moa_MyPageSubscriptionPanel t={t} />;
  }

  return (
    <Moa_MyPageAccountPanel
      t={t}
      profileName={profile.profileName}
      setProfileName={profile.setProfileName}
      profileEmail={profile.profileEmail}
      setProfileEmail={profile.setProfileEmail}
      profileMobile={profile.profileMobile}
      setProfileMobile={profile.setProfileMobile}
      profileBusy={profile.profileBusy}
      profileLoading={profile.profileLoading}
      profileBanner={profile.profileBanner}
      profileErr={profile.profileErr}
      profileSaveSubmitting={profile.profileSaveSubmitting}
      socialProviderLabel={account.socialProviderLabel}
      securityPanel={account.securityPanel}
      setSecurityPanel={account.setSecurityPanel}
      securityCurrentPassword={account.securityCurrentPassword}
      setSecurityCurrentPassword={account.setSecurityCurrentPassword}
      securityVerified={account.securityVerified}
      setSecurityVerified={account.setSecurityVerified}
      newPassword={account.newPassword}
      setNewPassword={account.setNewPassword}
      newPasswordConfirmation={account.newPasswordConfirmation}
      setNewPasswordConfirmation={account.setNewPasswordConfirmation}
      securitySubmitting={account.securitySubmitting}
      securityMessage={account.securityMessage}
      setSecurityMessage={account.setSecurityMessage}
      onSaveProfile={() => void profile.onSaveProfile(true)}
      onOpenPasswordPanel={account.onOpenPasswordPanel}
      onOpenWithdrawPanel={account.onOpenWithdrawPanel}
      onVerifySecurityPassword={account.onVerifySecurityPassword}
      onChangePassword={account.onChangePassword}
      onWithdraw={account.onWithdraw}
    />
  );
};
