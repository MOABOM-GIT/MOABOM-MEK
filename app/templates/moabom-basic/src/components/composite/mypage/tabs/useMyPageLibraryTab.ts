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
}

export function useMyPageLibraryTab({
  activeTab,
  isGuest,
  currentUser,
  createdApps,
}: UseMyPageLibraryTabOptions) {
  const [createdLibraryApps, setCreatedLibraryApps] = useState<App[]>([]);
  const [createdLibraryLoading, setCreatedLibraryLoading] = useState(false);

  useEffect(() => {
    if (createdApps) {
      setCreatedLibraryApps(createdApps);
      setCreatedLibraryLoading(false);
    }
  }, [createdApps]);

  useEffect(() => {
    if (createdApps) {
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
  }, [activeTab, isGuest, currentUser?.memberKey, createdApps]);

  return {
    createdLibraryApps,
    createdLibraryLoading,
  };
}
