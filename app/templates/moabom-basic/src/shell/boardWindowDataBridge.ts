import {
  refetchBoardWindowDataSource,
  setBoardWindowDataSource,
  type BoardWindowRefetchOptions,
  type BoardWindowRenderPayload,
  type BoardWindowSetOptions,
} from './boardWindowLayoutRuntime';

type BoardWindowDataSession = {
  sessionKey: string;
  dataSourceIds: ReadonlySet<string>;
  refetch: (
    dataSourceId: string,
    options?: BoardWindowRefetchOptions,
  ) => Promise<unknown>;
  set: (
    dataSourceId: string,
    data: unknown,
    options?: BoardWindowSetOptions,
  ) => unknown;
};

const sessions = new Map<string, BoardWindowDataSession>();
let refetchBridgeInstalled = false;
let setBridgeInstalled = false;

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

function resolveBoardDataSession(dataSourceId: string): BoardWindowDataSession | undefined {
  if (sessions.size === 1) {
    const session = sessions.values().next().value;
    if (session?.dataSourceIds.has(dataSourceId)) {
      return session;
    }
  }
  for (const session of sessions.values()) {
    if (session.dataSourceIds.has(dataSourceId)) {
      return session;
    }
  }
  return undefined;
}

function installBoardWindowRefetchBridge(): void {
  if (refetchBridgeInstalled || typeof window === 'undefined') {
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

  refetchBridgeInstalled = true;
}

function installBoardWindowSetBridge(): void {
  if (setBridgeInstalled || typeof window === 'undefined') {
    return;
  }

  const g7 = window as {
    G7Core?: {
      dataSource?: {
        set?: (
          dataSourceId: string,
          data: unknown,
          options?: BoardWindowSetOptions & { sync?: boolean },
        ) => void;
      };
    };
  };

  const originalSet = g7.G7Core?.dataSource?.set;
  if (!originalSet) {
    return;
  }

  g7.G7Core!.dataSource!.set = (dataSourceId, data, options) => {
    const session = resolveBoardDataSession(dataSourceId);
    if (session) {
      session.set(dataSourceId, data, options);
      return;
    }
    originalSet.call(g7.G7Core!.dataSource, dataSourceId, data, options);
  };

  setBridgeInstalled = true;
}

export type BoardWindowDataSessionHandle = {
  updateDataContext: (next: Record<string, unknown>) => void;
};

/**
 * 게시판 셸 윈도우가 마운트될 때 등록 — layout JSON 의 refetchDataSource / updateDataSource 가
 * TemplateApp 이 아닌 해당 윈도우 dataContext 를 갱신하도록 한다.
 */
export function registerBoardWindowDataSession(
  payload: BoardWindowRenderPayload,
  onDataContextChange: (next: Record<string, unknown>) => void,
): () => void {
  installBoardWindowRefetchBridge();
  installBoardWindowSetBridge();

  const dataSourceIds = new Set(payload.layoutDataSources.map(source => source.id));
  let currentContext = payload.dataContext;

  const applyContext = (next: Record<string, unknown>) => {
    currentContext = next;
    onDataContextChange(next);
  };

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
      applyContext(next);
      return next[dataSourceId];
    },
    set: (dataSourceId, data, options) => {
      const next = setBoardWindowDataSource(
        payload.layoutComputed,
        dataSourceId,
        data,
        payload.route,
        payload.query,
        currentContext,
        options,
      );
      applyContext(next);
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
