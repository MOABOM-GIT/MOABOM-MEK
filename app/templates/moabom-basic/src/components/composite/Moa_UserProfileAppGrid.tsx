import React, { useCallback, useMemo } from 'react';
import type { App } from '../../data/Moa_apps';
import { resolveAppStrings } from '../../i18n/resolveAppStrings';
import { useMoabomShellT } from '../../i18n/MoabomUiI18nProvider';
import { isGeneratedLibraryAppId } from '../../apps/generatedAppLibrary';
import { MOA_USER_PROFILE_APP_ID_ATTR } from '../../hooks/Moa_useHorizontalPointerStrip';
import { Button } from '../basic/Button';
import { Div } from '../basic/Div';
import { Moa_GeneratedAppIconShell } from './Moa_GeneratedAppIconShell';
import { Moa_HorizontalPointerStrip } from './Moa_HorizontalPointerStrip';
import { Moa_OverflowMarqueeText } from './Moa_OverflowMarqueeText';
import { openMoabomShellApp } from '../../shell/openMoabomShellApp';
import { mapUserProfileAppItemToLibraryApp } from './userProfile/mapUserProfileAppItem';

export interface MoaUserProfileAppGridProps {
  apps?: unknown[] | null;
  className?: string;
  /** 표시 상한 (자주 쓰는 앱 등) */
  maxItems?: number;
}

export const Moa_UserProfileAppGrid: React.FC<MoaUserProfileAppGridProps> = ({
  apps,
  className = '',
  maxItems,
}) => {
  const { language } = useMoabomShellT();

  const libraryApps = useMemo(() => {
    const items = Array.isArray(apps) ? apps : [];
    const mapped: App[] = [];
    const seen = new Set<string>();

    for (const item of items) {
      const app = mapUserProfileAppItemToLibraryApp(
        item && typeof item === 'object' ? (item as Record<string, unknown>) : {},
      );
      if (!app || seen.has(app.id)) {
        continue;
      }
      seen.add(app.id);
      mapped.push(app);
    }

    if (typeof maxItems === 'number' && maxItems > 0) {
      return mapped.slice(0, maxItems);
    }

    return mapped;
  }, [apps, maxItems]);

  const appsById = useMemo(() => {
    const map = new Map<string, App>();
    for (const app of libraryApps) {
      map.set(app.id, app);
    }
    return map;
  }, [libraryApps]);

  const openAppById = useCallback((appId: string) => {
    if (!appsById.has(appId)) {
      return;
    }
    openMoabomShellApp(appId);
  }, [appsById]);

  if (libraryApps.length === 0) {
    return null;
  }

  return (
    <Div className={`moa-user-profile-app-grid p-5${className ? ` ${className}` : ''}`}>
      <Moa_HorizontalPointerStrip
        className="moa-user-profile-app-strip flex items-start gap-3 overflow-x-auto cursor-grab active:cursor-grabbing"
        itemDataAttribute={MOA_USER_PROFILE_APP_ID_ATTR}
        onItemActivate={openAppById}
      >
        {libraryApps.map(app => {
          const { name } = resolveAppStrings(app, language);

          return (
            <Button
              key={app.id}
              type="button"
              data-user-profile-app-id={app.id}
              className="moa-user-profile-app-strip__item shrink-0 flex flex-col items-center gap-2 rounded-xl border-0 bg-transparent p-0 hover:opacity-90 transition-all cursor-pointer"
            >
              <Div className="flex w-[78px] flex-col items-center gap-2 p-0">
                <Moa_GeneratedAppIconShell
                  app={app}
                  showUserBadge={isGeneratedLibraryAppId(app.id)}
                  badgeSize="md"
                  iconClassName="w-16 h-16 rounded-2xl shrink-0 shadow-md"
                  symbolClassName="text-white text-xl"
                />
                <Div className="w-full min-w-0 text-center">
                  <Moa_OverflowMarqueeText
                    text={name}
                    className="text-xs font-bold text-primary text-center"
                  />
                </Div>
              </Div>
            </Button>
          );
        })}
      </Moa_HorizontalPointerStrip>
    </Div>
  );
};
