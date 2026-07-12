import {
  MoabomShellAuthExpiredError,
  MoabomShellAuthRequiredError,
  requestShellJson,
} from './moabomShellHttp';

export interface ShellNotificationItem {
  id: string;
  type: string;
  type_label: string;
  subject: string | null;
  body: string | null;
  url: string | null;
  data?: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string | null;
}

export interface ShellNotificationsPage {
  items: ShellNotificationItem[];
  hasMore: boolean;
  currentPage: number;
}

type NotificationsListPayload = {
  data?: ShellNotificationItem[];
  pagination?: {
    current_page?: number;
    has_more_pages?: boolean;
  };
};

type UnreadCountPayload = {
  unread_count?: number;
};

async function shellGet<T>(url: string): Promise<T | null> {
  try {
    return await requestShellJson<T>(url, 'required');
  } catch (error) {
    if (error instanceof MoabomShellAuthRequiredError || error instanceof MoabomShellAuthExpiredError) {
      return null;
    }
    return null;
  }
}

async function shellMutate(url: string, method: 'POST' | 'DELETE', body?: object): Promise<boolean> {
  try {
    await requestShellJson(url, 'required', { method, body: body ?? undefined });
    return true;
  } catch {
    return false;
  }
}

export async function fetchShellNotifications(
  page = 1,
  perPage = 20,
): Promise<{ ok: boolean; page: ShellNotificationsPage | null }> {
  const payload = await shellGet<NotificationsListPayload>(
    `/api/user/notifications?page=${page}&per_page=${perPage}&read=all&sort_order=desc`,
  );

  if (!payload) {
    return { ok: false, page: null };
  }

  return {
    ok: true,
    page: {
      items: payload.data ?? [],
      hasMore: !!payload.pagination?.has_more_pages,
      currentPage: payload.pagination?.current_page ?? page,
    },
  };
}

export async function fetchShellUnreadCount(): Promise<number> {
  const payload = await shellGet<UnreadCountPayload>('/api/user/notifications/unread-count');
  return payload?.unread_count ?? 0;
}

export async function markShellNotificationRead(id: string): Promise<boolean> {
  return shellMutate('/api/user/notifications/read-batch', 'POST', { ids: [id] });
}

export async function markAllShellNotificationsRead(): Promise<boolean> {
  return shellMutate('/api/user/notifications/read-all', 'POST');
}

export async function deleteAllShellNotifications(): Promise<boolean> {
  return shellMutate('/api/user/notifications/all', 'DELETE');
}
