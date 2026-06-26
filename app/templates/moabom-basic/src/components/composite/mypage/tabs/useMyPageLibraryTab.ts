import { useEffect, useState } from 'react';
import { fetchGeneratedApps } from '../../../../api/moabomAppsApi';
import { mapStoredGeneratedAppToLibraryApp } from '../../../../apps/generatedAppLibrary';
import type { App } from '../../../../data/Moa_apps';
import type { MyPageTab, MyPageUser } from '../myPageTypes';

interface UseMyPageLibraryTabOptions {
  activeTab: MyPageTab;
  isGuest: boolean;
  currentUser: MyPageUser | null;
  createdApps?: App[];
  createdAppsLoading?: boolean;
}

export function useMyPageLibraryTab({
  activeTab,
  isGuest,
  currentUser,
  createdApps,
  createdAppsLoading = false,
}: UseMyPageLibraryTabOptions) {
  const hasExternalCatalog = createdApps !== undefined;
  const [createdLibraryApps, setCreatedLibraryApps] = useState<App[]>([]);
  const [createdLibraryLoading, setCreatedLibraryLoading] = useState(false);

  useEffect(() => {
    if (!hasExternalCatalog) {
      return;
    }
    setCreatedLibraryApps(createdApps);
  }, [createdApps, hasExternalCatalog]);

  useEffect(() => {
    if (hasExternalCatalog) {
      return;
    }
    if (activeTab !== 'library' || isGuest) {
      return;
    }

    let cancelled = false;
    setCreatedLibraryLoading(true);

    void (async () => {
      try {
        const items = await fetchGeneratedApps();
        if (cancelled) {
          return;
        }
        setCreatedLibraryApps(items.map(mapStoredGeneratedAppToLibraryApp));
      } catch {
        if (!cancelled) {
          setCreatedLibraryApps([]);
        }
      } finally {
        if (!cancelled) {
          setCreatedLibraryLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, hasExternalCatalog, isGuest, currentUser?.memberKey]);

  return {
    createdLibraryApps: hasExternalCatalog ? createdApps : createdLibraryApps,
    createdLibraryLoading: hasExternalCatalog ? createdAppsLoading : createdLibraryLoading,
  };
}
