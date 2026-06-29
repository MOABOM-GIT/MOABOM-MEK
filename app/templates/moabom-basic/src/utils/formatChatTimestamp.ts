type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

/** 메시지 목록·헤더용 메신저 스타일 시각 */
export function formatChatListTimestamp(
  iso: string | null | undefined,
  t: TranslateFn,
): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();
  const time = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

  if (isSameDay(date, now)) {
    return time;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) {
    return t('moa_chat.time_yesterday', { time });
  }

  if (date.getFullYear() === now.getFullYear()) {
    return t('moa_chat.time_this_year', {
      month: date.getMonth() + 1,
      day: date.getDate(),
      time,
    });
  }

  return t('moa_chat.time_full', {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    time,
  });
}
