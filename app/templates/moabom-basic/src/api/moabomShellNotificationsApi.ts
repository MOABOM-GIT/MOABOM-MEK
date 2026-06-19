import { moabomApiGet, moabomApiPost } from './moabomAuthenticatedApi';

export interface ShellNotificationItem {
  id: string;
  type: string;
  type_label: string;
  subject: string | null;
  body: string | null;
  url: string | null;
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

export async function fetchShellNotifications(
  page = 1,
  perPage = 20,
): Promise<{ ok: boolean; page: ShellNotificationsPage | null }> {
  const result = await moabomApiGet<NotificationsListPayload>(
    `/api/user/notifications?page=${page}&per_page=${perPage}&read=all&sort_order=desc`,
  );

  if (!result.ok || !result.data) {
    return { ok: false, page: null };
  }

  const payload = result.data;
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
  const result = await moabomApiGet<UnreadCountPayload>('/api/user/notifications/unread-count');
  if (!result.ok) {
    return 0;
  }
  return result.data?.unread_count ?? 0;
}

export async function markShellNotificationRead(id: string): Promise<boolean> {
  const result = await moabomApiPost('/api/user/notifications/read-batch', { ids: [id] });
  return result.ok;
}

export async function markAllShellNotificationsRead(): Promise<boolean> {
  const result = await moabomApiPost('/api/user/notifications/read-all');
  return result.ok;
}
