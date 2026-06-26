import React, { Suspense } from 'react';
import type { AuthWindowMode } from '../../components/composite/Moa_AuthWindowContent';
import type { WindowState } from '../../components/composite/Moa_CenterPanel';
import type { MyPageTab } from '../../components/composite/mypage/myPageTypes';
import { hasMoabomShellAppChunk } from '../../apps';
import { GeneratedAppViewer } from '../../apps/generated/GeneratedAppViewer';
import { HospitalInfoApp } from '../../apps/hospital-info/HospitalInfoApp';
import { hospitalInfoAppMetadata } from '../../apps/hospital-info/metadata';
import { parseGeneratedLibraryServerId } from '../../apps/generatedAppLibrary';
import type { App } from '../../data/Moa_apps';
import type { MoabomTranslateFn } from '../../i18n/moabomT';
import {
  moaShellBoardSlugFromAppId,
  isMoaShellBoardAppId,
} from '../../shell/moaShellBoardIds';
import {
  isMoaShellUserProfileAppId,
  moaShellUserProfileUuidFromAppId,
} from '../../shell/moaShellUserProfileIds';
import { moaShellLegalPageSlugFromAppId } from '../../shell/moaShellLegalPageIds';
import { isMoaShellErrorAppId } from '../../shell/moaShellErrorIds';
import { APP_STACK_CLASS, APP_WINDOW_BODY_CLASS } from '../../apps/appShellTypography';
import { Div } from '../../components/basic/Div';
import { Icon } from '../../components/basic/Icon';
import AppLoadingSpinner from '../../components/composite/AppLoadingSpinner';
import { AUTH_WINDOW_APP_IDS } from '../../shell/moaShellLayoutConstants';
import { MoabomShellAppFromChunk } from './MoabomShellAppFromChunk';
import type { AuthUserLike, MoaCurrentUser, ShellUrlSync } from '../../shell/moaShellTypes';
import type { MoabomSystemDefaults, MoabomSystemState } from '../../types/moabomSystem';
import type { Dispatch, SetStateAction } from 'react';

const AuthWindowContentLazy = React.lazy(async () => {
  const m = await import('../../components/composite/Moa_AuthWindowContent');
  return { default: m.AuthWindowContent };
});

const MyPageWindowContentLazy = React.lazy(async () => {
  const m = await import('../../components/composite/Moa_MyPageWindowContent');
  return { default: m.MyPageWindowContent };
});

const LegalPageWindowContentLazy = React.lazy(async () => {
  const m = await import('../../components/composite/Moa_LegalPageWindowContent');
  return { default: m.LegalPageWindowContent };
});

const BoardWindowHostLazy = React.lazy(async () => {
  const m = await import('../../components/composite/Moa_BoardWindowHost');
  return { default: m.BoardWindowHost };
});

const ErrorWindowHostLazy = React.lazy(async () => {
  const m = await import('../../components/composite/Moa_ErrorWindowHost');
  return { default: m.ErrorWindowHost };
});

const UserProfileWindowHostLazy = React.lazy(async () => {
  const m = await import('../../components/composite/Moa_UserProfileWindowHost');
  return { default: m.UserProfileWindowHost };
});

export interface Moa_ShellWindowRendererProps {
  win: WindowState;
  t: MoabomTranslateFn;
  compactWindow: boolean;
  currentUser: MoaCurrentUser | null;
  createdApps: App[];
  createdAppsLoading?: boolean;
  favoriteApps: App[];
  recentApps: App[];
  shellSystem?: {
    systemState: MoabomSystemState;
    systemDefaults: MoabomSystemDefaults | null;
    setSystemState: Dispatch<SetStateAction<MoabomSystemState>>;
    setSystemDefaults: Dispatch<SetStateAction<MoabomSystemDefaults | null>>;
  };
  resolveWinTitle: (win: WindowState) => string;
  onOpenApp: (app: App) => void;
  onEditGeneratedApp: (serverId: number) => void;
  onDeleteGeneratedApp: (serverId: number) => void;
  onToggleGeneratedAppShare: (serverId: number, nextShared: boolean) => void | Promise<void>;
  onOpenAuthWindow: (mode: AuthWindowMode) => void;
  onAuthenticated: (user?: AuthUserLike | null) => void;
  onProfileUpdated: (user?: AuthUserLike | null) => void;
  onMyPageTabChange: (winId: string, tab: MyPageTab) => void;
  onOpenBoard: (slug: string, postId?: string, sync?: ShellUrlSync) => void;
  onLegalPageTitleResolved: (windowId: string, title: string) => void;
  onBoardWindowTitleResolved: (windowId: string, title: string) => void;
  onUserProfileWindowTitleResolved: (windowId: string, title: string) => void;
  onUserProfileViewChange: (windowId: string, view: import('../../shell/userProfileWindowLayoutRuntime').UserProfileWindowView) => void;
  onErrorWindowTitleResolved: (windowId: string, title: string) => void;
}

export const Moa_ShellWindowRenderer: React.FC<Moa_ShellWindowRendererProps> = ({
  win,
  t,
  compactWindow,
  currentUser,
  createdApps,
  createdAppsLoading = false,
  favoriteApps,
  recentApps,
  shellSystem,
  resolveWinTitle,
  onOpenApp,
  onEditGeneratedApp,
  onDeleteGeneratedApp,
  onToggleGeneratedAppShare,
  onOpenAuthWindow,
  onAuthenticated,
  onProfileUpdated,
  onMyPageTabChange,
  onOpenBoard,
  onLegalPageTitleResolved,
  onBoardWindowTitleResolved,
  onUserProfileWindowTitleResolved,
  onUserProfileViewChange,
  onErrorWindowTitleResolved,
}) => {
  if ((AUTH_WINDOW_APP_IDS as readonly string[]).includes(win.appId)) {
    return (
      <Suspense
        fallback={(
          <AppLoadingSpinner label={t('moa_shell.window.app_loading')} fill />
        )}
      >
        <AuthWindowContentLazy
          mode={win.appId as AuthWindowMode}
          onSwitchMode={onOpenAuthWindow}
          onAuthenticated={onAuthenticated}
          stretchVertically={compactWindow}
        />
      </Suspense>
    );
  }

  if (win.appId === 'mypage') {
    return (
      <Suspense
        fallback={(
          <AppLoadingSpinner label={t('moa_shell.window.app_loading')} fill />
        )}
      >
        <MyPageWindowContentLazy
          initialTab={win.myPageInitialTab}
          currentUser={currentUser}
          onOpenApp={onOpenApp}
          onEditGeneratedApp={onEditGeneratedApp}
          onDeleteGeneratedApp={onDeleteGeneratedApp}
          onToggleGeneratedAppShare={onToggleGeneratedAppShare}
          createdApps={createdApps}
          createdAppsLoading={createdAppsLoading}
          favoriteApps={favoriteApps}
          recentApps={recentApps}
          onProfileUpdated={onProfileUpdated}
          onActiveTabChange={tab => onMyPageTabChange(win.id, tab)}
          onOpenBoard={onOpenBoard}
          shellSystem={shellSystem}
        />
      </Suspense>
    );
  }

  if (win.appId === hospitalInfoAppMetadata.id) {
    return <HospitalInfoApp />;
  }

  const legalSlug = moaShellLegalPageSlugFromAppId(win.appId);
  if (legalSlug) {
    return (
      <Suspense
        fallback={(
          <AppLoadingSpinner label={t('moa_shell.center.legal_page_loading')} fill />
        )}
      >
        <LegalPageWindowContentLazy
          slug={legalSlug}
          onResolvedTitle={title => onLegalPageTitleResolved(win.id, title)}
        />
      </Suspense>
    );
  }

  if (isMoaShellBoardAppId(win.appId)) {
    return (
      <Suspense
        fallback={(
          <AppLoadingSpinner label={t('moa_shell.center.board_loading')} fill />
        )}
      >
        <BoardWindowHostLazy
          appId={win.appId}
          boardSlug={win.boardSlug ?? moaShellBoardSlugFromAppId(win.appId) ?? undefined}
          boardPostId={win.boardPostId}
          boardMode={win.boardMode}
          authStateKey={currentUser?.memberKey ?? ''}
          onResolvedTitle={title => onBoardWindowTitleResolved(win.id, title)}
        />
      </Suspense>
    );
  }

  if (isMoaShellUserProfileAppId(win.appId)) {
    return (
      <Suspense
        fallback={(
          <AppLoadingSpinner label={t('moa_shell.center.user_profile_loading')} fill />
        )}
      >
        <UserProfileWindowHostLazy
          key={win.userProfileUuid ?? moaShellUserProfileUuidFromAppId(win.appId) ?? win.id}
          appId={win.appId}
          userUuid={win.userProfileUuid ?? moaShellUserProfileUuidFromAppId(win.appId) ?? undefined}
          userProfileView={win.userProfileView ?? 'profile'}
          authStateKey={currentUser?.memberKey ?? ''}
          onResolvedTitle={title => onUserProfileWindowTitleResolved(win.id, title)}
          onViewChange={view => onUserProfileViewChange(win.id, view)}
        />
      </Suspense>
    );
  }

  if (isMoaShellErrorAppId(win.appId) && win.errorCode != null) {
    return (
      <Suspense
        fallback={(
          <AppLoadingSpinner label={t('moa_shell.center.error_page_loading')} fill />
        )}
      >
        <ErrorWindowHostLazy
          errorCode={win.errorCode}
          onResolvedTitle={title => onErrorWindowTitleResolved(win.id, title)}
        />
      </Suspense>
    );
  }

  const generatedServerId = parseGeneratedLibraryServerId(win.appId);
  if (generatedServerId != null) {
    return (
      <GeneratedAppViewer
        serverId={generatedServerId}
        onEditGeneratedApp={onEditGeneratedApp}
        onDeleteGeneratedApp={onDeleteGeneratedApp}
        onToggleGeneratedAppShare={onToggleGeneratedAppShare}
      />
    );
  }

  if (hasMoabomShellAppChunk(win.appId)) {
    return (
      <MoabomShellAppFromChunk
        appId={win.appId}
        editGeneratedAppId={win.editGeneratedAppId}
      />
    );
  }

  return (
    <Div className={`${APP_WINDOW_BODY_CLASS} ${APP_STACK_CLASS} min-h-full items-center justify-center text-primary`}>
      <Div className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl" style={{ background: win.gradient }}>
        <Icon name={win.icon} className="text-white text-4xl" />
      </Div>
      <Div className="text-center">
        <Div className="text-2xl font-bold text-secondary mb-2">{resolveWinTitle(win)}</Div>
        <Div className="text-sm text-faint">{t('moa_shell.window.placeholder_content')}</Div>
      </Div>
    </Div>
  );
};
