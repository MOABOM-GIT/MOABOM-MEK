import React, { Suspense } from 'react';
import type { AuthWindowMode } from '../../components/composite/Moa_AuthWindowContent';
import type { WindowState } from '../../components/composite/Moa_CenterPanel';
import type { MyPageTab } from '../../components/composite/mypage/myPageTypes';
import { hasMoabomShellAppChunk } from '../../apps';
import { GeneratedAppViewer } from '../../apps/generated/GeneratedAppViewer';
import { parseGeneratedLibraryServerId } from '../../apps/generatedAppLibrary';
import type { App } from '../../data/Moa_apps';
import type { MoabomTranslateFn } from '../../i18n/moabomT';
import {
  moaShellLegalPageSlugFromAppId,
} from '../../shell/moaShellLegalPageIds';
import { Div } from '../../components/basic/Div';
import { Icon } from '../../components/basic/Icon';
import { AUTH_WINDOW_APP_IDS } from './moaHomeConstants';
import { MoabomShellAppFromChunk } from './MoabomShellAppFromChunk';
import type { AuthUserLike, MoaCurrentUser } from './moaHomeTypes';

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

export interface Moa_ShellWindowRendererProps {
  win: WindowState;
  t: MoabomTranslateFn;
  compactWindow: boolean;
  currentUser: MoaCurrentUser | null;
  favoriteApps: App[];
  recentApps: App[];
  resolveWinTitle: (win: WindowState) => string;
  onOpenApp: (app: App) => void;
  onEditGeneratedApp: (serverId: number) => void;
  onOpenAuthWindow: (mode: AuthWindowMode) => void;
  onAuthenticated: (user?: AuthUserLike | null) => void;
  onProfileUpdated: (user?: AuthUserLike | null) => void;
  onMyPageTabChange: (winId: string, tab: MyPageTab) => void;
  onLegalPageTitleResolved: (windowId: string, title: string) => void;
}

export const Moa_ShellWindowRenderer: React.FC<Moa_ShellWindowRendererProps> = ({
  win,
  t,
  compactWindow,
  currentUser,
  favoriteApps,
  recentApps,
  resolveWinTitle,
  onOpenApp,
  onEditGeneratedApp,
  onOpenAuthWindow,
  onAuthenticated,
  onProfileUpdated,
  onMyPageTabChange,
  onLegalPageTitleResolved,
}) => {
  if ((AUTH_WINDOW_APP_IDS as readonly string[]).includes(win.appId)) {
    return (
      <Suspense
        fallback={(
          <Div className="flex min-h-[200px] w-full items-center justify-center text-faint text-sm" role="status">
            {t('moa_shell.window.app_loading')}
          </Div>
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
          <Div className="flex min-h-[200px] w-full items-center justify-center text-faint text-sm" role="status">
            {t('moa_shell.window.app_loading')}
          </Div>
        )}
      >
        <MyPageWindowContentLazy
          initialTab={win.myPageInitialTab}
          currentUser={currentUser}
          onOpenApp={onOpenApp}
          onEditGeneratedApp={onEditGeneratedApp}
          favoriteApps={favoriteApps}
          recentApps={recentApps}
          onProfileUpdated={onProfileUpdated}
          onActiveTabChange={tab => onMyPageTabChange(win.id, tab)}
        />
      </Suspense>
    );
  }

  const legalSlug = moaShellLegalPageSlugFromAppId(win.appId);
  if (legalSlug) {
    return (
      <Suspense
        fallback={(
          <Div className="flex min-h-[200px] w-full items-center justify-center text-faint text-sm" role="status">
            {t('moa_shell.center.legal_page_loading')}
          </Div>
        )}
      >
        <LegalPageWindowContentLazy
          slug={legalSlug}
          onResolvedTitle={title => onLegalPageTitleResolved(win.id, title)}
        />
      </Suspense>
    );
  }

  const generatedServerId = parseGeneratedLibraryServerId(win.appId);
  if (generatedServerId != null) {
    return <GeneratedAppViewer serverId={generatedServerId} />;
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
    <Div className="flex min-h-full flex-col items-center justify-center gap-4 pt-3 text-primary">
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
