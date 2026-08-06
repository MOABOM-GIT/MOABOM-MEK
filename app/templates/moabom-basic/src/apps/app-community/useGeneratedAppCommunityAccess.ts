import { useEffect, useState } from 'react';
import { loadVisibleGeneratedAppSession } from '../generated/generatedAppVisibleSessionCache';
import { isShellAuthMember } from '../../shell/moaShellAuthStateKey';

export interface GeneratedAppCommunityAccess {
  canWrite: boolean;
  isResolving: boolean;
}

/**
 * 앱 리뷰 작성 권한 — visible 메타 show(`include_html=0`) permissions SSOT.
 * `authStateKey` 변경(로그인·로그아웃) 시 재조회한다.
 */
export function useGeneratedAppCommunityAccess(
  serverId: number,
  authStateKey: string,
): GeneratedAppCommunityAccess {
  const [canWrite, setCanWrite] = useState(false);
  const [isResolving, setIsResolving] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsResolving(true);

    void (async () => {
      if (!isShellAuthMember(authStateKey)) {
        if (!cancelled) {
          setCanWrite(false);
          setIsResolving(false);
        }
        return;
      }

      try {
        const app = await loadVisibleGeneratedAppSession(serverId, authStateKey);
        if (cancelled) {
          return;
        }
        setCanWrite(Boolean(app.permissions?.can_community_write));
      } catch {
        if (!cancelled) {
          setCanWrite(false);
        }
      } finally {
        if (!cancelled) {
          setIsResolving(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authStateKey, serverId]);

  return { canWrite, isResolving };
}
