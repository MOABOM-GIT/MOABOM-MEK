export type AppCommunityRevisionPayload = {
  generated_app_id: number;
  revision: number;
  reason?: string;
};

type G7WebSocketApi = {
  subscribe?: (
    channel: string,
    event: string,
    callback: (data: unknown) => void,
    options?: { channelType?: 'public' | 'private' | 'presence' },
  ) => string;
  unsubscribe?: (subscriptionKey: string) => void;
};

function getWebSocketApi(): G7WebSocketApi | null {
  return (window as { G7Core?: { websocket?: G7WebSocketApi } }).G7Core?.websocket ?? null;
}

export function appCommunityRevisionChannel(generatedAppId: number): string {
  return `moabom-app-community.${generatedAppId}`;
}

/**
 * 앱 이야기 revision public 채널 — admin 숨김·복구·삭제 후 열린 창 silent reload.
 */
export function subscribeAppCommunityRevisionChannel(
  generatedAppId: number,
  onRevision: (payload: AppCommunityRevisionPayload) => void,
): string | null {
  const ws = getWebSocketApi();
  if (!ws?.subscribe) {
    return null;
  }

  const subscriptionKey = ws.subscribe(
    appCommunityRevisionChannel(generatedAppId),
    'app_community.revision',
    (raw: unknown) => {
      if (!raw || typeof raw !== 'object') {
        return;
      }
      const payload = raw as Partial<AppCommunityRevisionPayload>;
      if (typeof payload.revision !== 'number' || typeof payload.generated_app_id !== 'number') {
        return;
      }
      if (payload.generated_app_id !== generatedAppId) {
        return;
      }
      onRevision({
        generated_app_id: payload.generated_app_id,
        revision: payload.revision,
        reason: payload.reason,
      });
    },
    { channelType: 'public' },
  );

  return subscriptionKey || null;
}

export function unsubscribeAppCommunityRevisionChannel(subscriptionKey: string): void {
  if (!subscriptionKey) {
    return;
  }
  getWebSocketApi()?.unsubscribe?.(subscriptionKey);
}
