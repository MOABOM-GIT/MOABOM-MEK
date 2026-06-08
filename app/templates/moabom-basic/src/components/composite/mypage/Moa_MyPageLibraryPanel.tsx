import React from 'react';
import type { MoabomTranslateFn } from '../../../i18n/moabomT';
import type { MoabomSystemLanguage } from '../../../types/moabomSystem';
import type { App } from '../../../data/Moa_apps';
import { Div } from '../../basic/Div';
import { LibrarySection, LockedLibrarySection } from './Moa_MyPageLibraryBlocks';

export interface Moa_MyPageLibraryPanelProps {
  t: MoabomTranslateFn;
  locale: MoabomSystemLanguage;
  isGuest: boolean;
  onOpenApp?: (app: App) => void;
  onEditGeneratedApp?: (serverId: number) => void;
  /** 서버에 저장된 AI 생성 앱 (GET apps/generated) */
  createdApps: App[];
  createdAppsLoading?: boolean;
  favoriteApps: App[];
  recentApps: App[];
}

export const Moa_MyPageLibraryPanel: React.FC<Moa_MyPageLibraryPanelProps> = ({
  t,
  locale,
  isGuest,
  onOpenApp,
  onEditGeneratedApp,
  createdApps,
  createdAppsLoading = false,
  favoriteApps,
  recentApps,
}) => {
  const appInfoFallback = t('moa_mypage.library.app_info_fallback');
  const createdEmptyText = createdAppsLoading
    ? t('moa_mypage.library.created_loading')
    : t('moa_mypage.library.created_empty');

  return (
    <Div className="flex flex-col gap-3">
      {isGuest ? (
        <LockedLibrarySection title={t('moa_mypage.library.created_title')} message={t('moa_mypage.library.created_guest_msg')} />
      ) : (
        <LibrarySection
          title={t('moa_mypage.library.created_title')}
          locale={locale}
          apps={createdApps}
          emptyText={createdEmptyText}
          appInfoFallback={appInfoFallback}
          onOpenApp={onOpenApp}
          onEditGeneratedApp={onEditGeneratedApp}
          editAriaLabel={t('moa_mypage.library.edit_app')}
        />
      )}
      <LibrarySection
        title={t('moa_mypage.library.recent_title')}
        locale={locale}
        apps={recentApps}
        emptyText={t('moa_mypage.library.recent_empty')}
        appInfoFallback={appInfoFallback}
        onOpenApp={onOpenApp}
      />
      <LibrarySection
        title={t('moa_mypage.library.favorites_title')}
        locale={locale}
        apps={favoriteApps}
        emptyText={t('moa_mypage.library.favorites_empty')}
        appInfoFallback={appInfoFallback}
        onOpenApp={onOpenApp}
      />
    </Div>
  );
};
