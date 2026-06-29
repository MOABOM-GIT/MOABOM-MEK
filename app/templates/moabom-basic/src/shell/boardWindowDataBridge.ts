import {
  refetchBoardWindowDataSource,
  type BoardWindowRefetchOptions,
  type BoardWindowRenderPayload,
} from './boardWindowLayoutRuntime';

type BoardWindowDataSession = {
  sessionKey: string;
  dataSourceIds: ReadonlySet<string>;
  refetch: (
    dataSourceId: string,
    options?: BoardWindowRefetchOptions,
  ) => Promise<unknown>;
};

const sessions = new Map<string, BoardWindowDataSession>();
let bridgeInstalled = false;

function resolveSessionFromOptions(
  options?: BoardWindowRefetchOptions,
): BoardWindowDataSession | undefined {
  const key = options?.localStateOverride?.__boardSessionKey;
  if (typeof key === 'string') {
    return sessions.get(key);
  }
  if (sessions.size === 1) {
    return sessions.values().next().value;
  }
  return undefined;
}

function installBoardWindowRefetchBridge(): void {
  if (bridgeInstalled || typeof window === 'undefined') {
    return;
  }

  const g7 = window as {
    G7Core?: {
      dataSource?: {
        refetch?: (
          dataSourceId: string,
          options?: BoardWindowRefetchOptions & { sync?: boolean },
        ) => Promise<unknown>;
      };
    };
  };

  const originalRefetch = g7.G7Core?.dataSource?.refetch;
  if (!originalRefetch) {
    return;
  }

  g7.G7Core!.dataSource!.refetch = async (dataSourceId, options) => {
    const session = resolveSessionFromOptions(options);
    if (session?.dataSourceIds.has(dataSourceId)) {
      return session.refetch(dataSourceId, options);
    }
    return originalRefetch.call(g7.G7Core!.dataSource, dataSourceId, options);
  };

  bridgeInstalled = true;
}

export type BoardWindowDataSessionHandle = {
  updateDataContext: (next: Record<string, unknown>) => void;
};

/**
 * 게시판 셸 윈도우가 마운트될 때 등록 — layout JSON 의 refetchDataSource 가
 * TemplateApp 이 아닌 해당 윈도우 dataContext 를 갱신하도록 한다.
 */
export function registerBoardWindowDataSession(
  payload: BoardWindowRenderPayload,
  onDataContextChange: (next: Record<string, unknown>) => void,
): () => void {
  installBoardWindowRefetchBridge();

  const dataSourceIds = new Set(payload.layoutDataSources.map(source => source.id));
  let currentContext = payload.dataContext;

  const session: BoardWindowDataSession = {
    sessionKey: payload.boardSessionKey,
    dataSourceIds,
    refetch: async (dataSourceId, options) => {
      const next = await refetchBoardWindowDataSource(
        payload.layoutDataSources,
        payload.layoutComputed,
        dataSourceId,
        payload.route,
        payload.query,
        currentContext,
        options,
      );
      if (!next) {
        return undefined;
      }
      currentContext = next;
      onDataContextChange(next);
      return next[dataSourceId];
    },
  };

  sessions.set(payload.boardSessionKey, session);

  return () => {
    sessions.delete(payload.boardSessionKey);
  };
}

export function invalidateBoardWindowBindingCache(
  bindingEngine: unknown,
  keys: string[] = ['post', '_computed', '_local'],
): void {
  const engine = bindingEngine as { invalidateCacheByKeys?: (cacheKeys: string[]) => void } | null;
  engine?.invalidateCacheByKeys?.(keys);
}
