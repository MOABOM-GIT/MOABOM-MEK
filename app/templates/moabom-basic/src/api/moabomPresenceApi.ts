import { getShellAccessToken } from './moabomShellAccess';
import { getOrCreateShellVisitorId } from '../shell/ShellContextBridge';

export type PresenceHeartbeatTouch = 'login' | 'logout' | 'touch';

export type PresenceAvailability = 'online' | 'away' | 'busy' | 'offline';

export type PresenceSubtitleMode = 'profile_bio' | 'activity' | 'hidden';

export type PresenceSettings = {
  availability: PresenceAvailability;
  subtitle_mode: PresenceSubtitleMode;
  activity_message?: string | null;
  show_avatar_in_connect_list: boolean;
  accept_chat_requests: boolean;
};

export type OwnPresenceState = {
  availability: PresenceAvailability;
  subtitle_mode: PresenceSubtitleMode;
  presence_subtitle?: string | null;
  is_reachable: boolean;
};

export type ClientFormFactor = 'desktop' | 'mobile';

export type PresenceOnlineUser = {
  session_key: string;
  visitor_id?: string | null;
  user_uuid?: string | null;
  client_ip_masked?: string | null;
  display_name: string;
  status_text?: string | null;
  presence_subtitle?: string | null;
  avatar?: string | null;
  is_authenticated: boolean;
  availability?: PresenceAvailability;
  is_online: boolean;
  client_form_factor?: ClientFormFactor | null;
  friendship: 'none' | 'accepted' | 'outgoing_pending' | 'incoming_pending' | 'blocked';
  last_seen_at?: string | null;
};

export type PresenceFriend = {
  user_uuid: string;
  display_name: string;
  avatar?: string | null;
  status_text?: string | null;
  presence_subtitle?: string | null;
  availability?: PresenceAvailability;
  is_online: boolean;
  friendship: 'accepted';
  accepted_at?: string | null;
};

export type PresenceSummary = {
  platform_total: number;
  tenant_active: number;
  mirror_ok?: boolean;
  mirror_degraded?: boolean;
  revision?: number;
  revision_channel?: string;
  platform_revision_channel?: string;
  presence_channel: string;
  heartbeat_interval_sec: number;
};

export type PresenceOnlinePayload = {
  users: PresenceOnlineUser[];
  revision?: number;
};

export type PresenceHeartbeatResult = {
  accepted: boolean;
  reason?: 'bot' | 'tenant_storage_unavailable' | 'transient_failure' | string;
  session_key?: string;
  visitor_id?: string;
  mirror_ok?: boolean;
  revision?: number;
  tenant_channel?: string;
  availability?: PresenceAvailability;
  subtitle_mode?: PresenceSubtitleMode;
  presence_subtitle?: string | null;
  is_reachable?: boolean;
};

export type PublicUserPresence = {
  user_uuid: string;
  availability: PresenceAvailability;
  subtitle_mode: PresenceSubtitleMode;
  activity_message?: string | null;
  presence_subtitle?: string | null;
  is_reachable: boolean;
};

const API_BASE = '/api/modules/moabom-presence';

function presenceHeaders(): Record<string, string> {
  const visitorId = getOrCreateShellVisitorId();
  return {
    'X-Moabom-Visitor-Id': visitorId,
    'X-Moabom-Presence-Key': visitorId,
  };
}

function authHeaders(): Record<string, string> {
  const token = getShellAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseModuleJson<T>(response: Response): Promise<T> {
  const json = await response.json();
  if (!response.ok || json?.success === false) {
    throw new Error(json?.message || 'presence_api_error');
  }
  return json.data as T;
}

export async function fetchPresenceSummary(): Promise<PresenceSummary> {
  const response = await fetch(`${API_BASE}/public/summary`, {
    credentials: 'include',
    headers: presenceHeaders(),
  });
  return parseModuleJson<PresenceSummary>(response);
}

export async function fetchPresenceOnlineUsers(): Promise<PresenceOnlinePayload> {
  const response = await fetch(`${API_BASE}/public/online`, {
    credentials: 'include',
    headers: {
      ...presenceHeaders(),
      Accept: 'application/json',
      ...authHeaders(),
    },
  });
  const data = await parseModuleJson<PresenceOnlinePayload>(response);
  return {
    users: data.users ?? [],
    revision: data.revision,
  };
}

export async function sendPresenceHeartbeat(
  statusText?: string | null,
  clientFormFactor?: ClientFormFactor | null,
  touch?: PresenceHeartbeatTouch,
): Promise<PresenceHeartbeatResult> {
  const body: {
    status_text?: string;
    client_form_factor?: ClientFormFactor;
    touch?: PresenceHeartbeatTouch;
  } = {};
  const trimmed = statusText?.trim();
  if (trimmed) {
    body.status_text = trimmed.slice(0, 255);
  }
  if (clientFormFactor) {
    body.client_form_factor = clientFormFactor;
  }
  if (touch) {
    body.touch = touch;
  }
  const response = await fetch(`${API_BASE}/public/heartbeat`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...presenceHeaders(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  });
  return parseModuleJson<PresenceHeartbeatResult>(response);
}

const PRESENCE_SETTINGS_MEMORY_TTL_MS = 30_000;
let presenceSettingsCache: { value: PresenceSettings; expiresAt: number } | null = null;
let presenceSettingsPromise: Promise<PresenceSettings> | null = null;

export function invalidatePresenceSettingsCache(): void {
  presenceSettingsCache = null;
}

export function __resetPresenceSettingsCacheForTest(): void {
  presenceSettingsCache = null;
  presenceSettingsPromise = null;
}

export async function fetchPresenceSettings(): Promise<PresenceSettings> {
  const now = Date.now();
  if (presenceSettingsCache && presenceSettingsCache.expiresAt > now) {
    return presenceSettingsCache.value;
  }

  if (presenceSettingsPromise) {
    return presenceSettingsPromise;
  }

  presenceSettingsPromise = (async () => {
    const { runMoabomShellRealtimeTask } = await import('../runtime/moabomShellRealtimeRequestCoalescer');
    return runMoabomShellRealtimeTask(
      'presence:user-settings',
      async () => {
        const response = await fetch(`${API_BASE}/user/presence/settings`, {
          credentials: 'include',
          headers: {
            Accept: 'application/json',
            ...authHeaders(),
          },
        });
        const data = await parseModuleJson<PresenceSettings>(response);
        presenceSettingsCache = {
          value: data,
          expiresAt: Date.now() + PRESENCE_SETTINGS_MEMORY_TTL_MS,
        };
        return data;
      },
      { minIntervalMs: 2_000 },
    );
  })();

  try {
    return await presenceSettingsPromise;
  } finally {
    presenceSettingsPromise = null;
  }
}

export async function updatePresenceSettings(
  payload: Partial<PresenceSettings>,
): Promise<PresenceSettings> {
  const response = await fetch(`${API_BASE}/user/presence/settings`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });
  const data = await parseModuleJson<PresenceSettings>(response);
  presenceSettingsCache = {
    value: data,
    expiresAt: Date.now() + PRESENCE_SETTINGS_MEMORY_TTL_MS,
  };
  return data;
}

export async function fetchPublicUserPresence(userUuid: string): Promise<PublicUserPresence> {
  const response = await fetch(`${API_BASE}/public/users/${encodeURIComponent(userUuid)}/presence`, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...presenceHeaders(),
      ...authHeaders(),
    },
  });
  return parseModuleJson<PublicUserPresence>(response);
}

export async function fetchPresenceFriends(): Promise<PresenceFriend[]> {
  if (!getShellAccessToken()) {
    return [];
  }
  const response = await fetch(`${API_BASE}/user/friends`, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...authHeaders(),
    },
  });
  const data = await parseModuleJson<{ friends: PresenceFriend[] }>(response);
  return data.friends ?? [];
}

export async function requestPresenceFriend(userUuid: string): Promise<void> {
  if (!getShellAccessToken()) {
    throw new Error('auth_required');
  }
  const response = await fetch(`${API_BASE}/user/friends`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ user_uuid: userUuid }),
  });
  await parseModuleJson(response);
}

export async function acceptPresenceFriend(userUuid: string): Promise<void> {
  if (!getShellAccessToken()) {
    throw new Error('auth_required');
  }
  const response = await fetch(`${API_BASE}/user/friends/accept`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ user_uuid: userUuid }),
  });
  await parseModuleJson(response);
}

export async function removePresenceFriend(userUuid: string): Promise<void> {
  if (!getShellAccessToken()) {
    throw new Error('auth_required');
  }
  const response = await fetch(`${API_BASE}/user/friends/${encodeURIComponent(userUuid)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...authHeaders(),
    },
  });
  await parseModuleJson(response);
}
