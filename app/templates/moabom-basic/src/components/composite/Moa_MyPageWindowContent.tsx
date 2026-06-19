import React, { useMemo, useRef } from 'react';
import { useMoabomShellT } from '../../i18n/MoabomUiI18nProvider';
import { Div } from '../basic/Div';
import { Moa_MyPageSidebar } from './mypage/Moa_MyPageSidebar';
import { Moa_MyPageTabPanels } from './mypage/Moa_MyPageTabPanels';
import { buildMyPageSidebarTabs } from './mypage/myPageMenuModel';
import { OUTER_GLASS } from './mypage/myPageStyles';
import type { MyPageWindowContentProps } from './mypage/myPageTypes';
import { getSocialProviderLabel, useMyPageAccountTab } from './mypage/tabs/useMyPageAccountTab';
import { useMyPageActivityTab } from './mypage/tabs/useMyPageActivityTab';
import { useMyPageCreditTab } from './mypage/tabs/useMyPageCreditTab';
import { useMyPageLibraryTab } from './mypage/tabs/useMyPageLibraryTab';
import { useMyPageProfileTab } from './mypage/tabs/useMyPageProfileTab';
import { useMyPageShellState } from './mypage/useMyPageShellState';
import { useMyPageTabRouting } from './mypage/useMyPageTabRouting';

export type { AuthManagerUserSnapshot, MyPageTab, MyPageUser, MyPageWindowContentProps } from './mypage/myPageTypes';

export const MyPageWindowContent: React.FC<MyPageWindowContentProps> = ({
  initialTab = 'profile',
  currentUser,
  onOpenApp,
  createdApps,
  favoriteApps = [],
  recentApps = [],
  onProfileUpdated,
  onActiveTabChange,
}) => {
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const isGuest = !currentUser;
  const isLoggedIn = Boolean(currentUser);
  const { t, language: shellLanguage } = useMoabomShellT();

  const { systemDefaults, systemState, handleSystemStateChange } = useMyPageShellState({
    currentUser,
    onProfileUpdated,
  });

  const menusFromDefaults = systemDefaults?.mypage?.menus;

  const { activeTab, handleSelectTab } = useMyPageTabRouting({
    initialTab,
    isLoggedIn,
    menusFromDefaults,
    onActiveTabChange,
  });

  const profile = useMyPageProfileTab({
    activeTab,
    currentUser,
    shellLanguage,
    t,
    avatarInputRef,
    onProfileUpdated,
  });

  const credit = useMyPageCreditTab({
    activeTab,
    currentUser,
    shellLanguage,
    t,
  });

  const library = useMyPageLibraryTab({
    activeTab,
    isGuest,
    currentUser,
    createdApps,
  });

  const activity = useMyPageActivityTab({
    activeTab,
    currentUser,
    shellLanguage,
    t,
  });

  const socialProviderLabel = getSocialProviderLabel(
    currentUser?.social_provider ?? profile.profileSocialProvider,
    t,
  );

  const account = useMyPageAccountTab({
    t,
    socialProviderLabel,
  });

  const tabs = useMemo(
    () => buildMyPageSidebarTabs(t, menusFromDefaults),
    [t, menusFromDefaults, shellLanguage],
  );

  return (
    <Div className={OUTER_GLASS}>
      <Div className="moa-mypage-layout">
        <Moa_MyPageSidebar
          t={t}
          tabs={tabs}
          activeTab={activeTab}
          isGuest={isGuest}
          onSelectTab={handleSelectTab}
        />
        <Div className="moa-mypage-content">
          <Moa_MyPageTabPanels
            activeTab={activeTab}
            t={t}
            shellLanguage={shellLanguage}
            currentUser={currentUser}
            isGuest={isGuest}
            systemDefaults={systemDefaults}
            systemState={systemState}
            onSystemStateChange={handleSystemStateChange}
            onOpenApp={onOpenApp}
            favoriteApps={favoriteApps}
            recentApps={recentApps}
            profile={{
              nickname: profile.nickname,
              setNickname: profile.setNickname,
              bio: profile.bio,
              setBio: profile.setBio,
              avatarUrl: profile.avatarUrl,
              avatarInputRef,
              profileBusy: profile.profileBusy,
              profileLoading: profile.profileLoading,
              profileBanner: profile.profileBanner,
              profileErr: profile.profileErr,
              userInitial: profile.userInitial,
              profileSaveSubmitting: profile.profileSaveSubmitting,
              avatarUploading: profile.avatarUploading,
              onAvatarFile: profile.handleAvatarFile,
              onSaveProfile: profile.handleSaveProfile,
              profileName: profile.profileName,
              setProfileName: profile.setProfileName,
              profileEmail: profile.profileEmail,
              setProfileEmail: profile.setProfileEmail,
              profileMobile: profile.profileMobile,
              setProfileMobile: profile.setProfileMobile,
            }}
            credit={{
              creditBalance: credit.creditBalance,
              creditOverview: credit.creditOverview,
              creditLoading: credit.creditLoading,
              creditError: credit.creditError,
              attendanceLoading: credit.attendanceLoading,
              attendanceMessage: credit.attendanceMessage,
              onAttendanceCheck: () => void credit.handleAttendanceCheck(),
            }}
            library={{
              createdLibraryApps: library.createdLibraryApps,
              createdLibraryLoading: library.createdLibraryLoading,
            }}
            activity={{
              activityOverview: activity.activityOverview,
              activityFilter: activity.activityFilter,
              setActivityFilter: activity.setActivityFilter,
              activityLoading: activity.activityLoading,
              activityError: activity.activityError,
              onOpenActivity: activity.handleOpenActivity,
            }}
            account={{
              socialProviderLabel,
              securityPanel: account.securityPanel,
              setSecurityPanel: account.setSecurityPanel,
              securityCurrentPassword: account.securityCurrentPassword,
              setSecurityCurrentPassword: account.setSecurityCurrentPassword,
              securityVerified: account.securityVerified,
              setSecurityVerified: account.setSecurityVerified,
              newPassword: account.newPassword,
              setNewPassword: account.setNewPassword,
              newPasswordConfirmation: account.newPasswordConfirmation,
              setNewPasswordConfirmation: account.setNewPasswordConfirmation,
              securitySubmitting: account.securitySubmitting,
              securityMessage: account.securityMessage,
              setSecurityMessage: account.setSecurityMessage,
              onOpenPasswordPanel: account.handleOpenPasswordPanel,
              onOpenWithdrawPanel: account.handleOpenWithdrawPanel,
              onVerifySecurityPassword: () => void account.handleVerifySecurityPassword(),
              onChangePassword: () => void account.handleChangePassword(),
              onWithdraw: () => void account.handleWithdraw(),
            }}
          />
        </Div>
      </Div>
    </Div>
  );
};
