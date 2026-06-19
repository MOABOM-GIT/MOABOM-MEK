/** G7 UserNotificationResource `read_at` 과 동일한 `Y-m-d H:i:s` 형식. */
export function shellNotificationReadTimestamp(date = new Date()): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export function isShellNotificationUnread(readAt: string | null | undefined): boolean {
  return !readAt;
}
