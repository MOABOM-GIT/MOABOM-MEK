import type { IconName } from '../components/basic/IconTypes';
import { iconNameMap } from '../components/basic/IconTypes';

export interface NotificationVisual {
  icon: IconName | keyof typeof iconNameMap;
  iconColor: string;
  iconBg: string;
}

/** 알림 타입별 우측 패널 더미 스타일과 동일한 아이콘·색상 매핑 */
export function getNotificationVisual(type: string | null | undefined): NotificationVisual {
  const key = (type ?? '').toLowerCase();

  if (key.includes('comment') || key === 'reply_comment' || key === 'new_comment') {
    return {
      icon: 'comment',
      iconColor: 'text-blue-500 dark:text-blue-400',
      iconBg: 'bg-blue-50 dark:bg-blue-950/35',
    };
  }

  if (key.includes('order') || key.includes('ship') || key.includes('inquiry')) {
    return {
      icon: 'shopping-bag',
      iconColor: 'text-violet-500 dark:text-violet-400',
      iconBg: 'bg-violet-50 dark:bg-violet-950/35',
    };
  }

  if (key.includes('report')) {
    return {
      icon: 'flag',
      iconColor: 'text-amber-500 dark:text-amber-400',
      iconBg: 'bg-amber-50 dark:bg-amber-950/35',
    };
  }

  if (key.includes('post') || key === 'post_reply') {
    return {
      icon: 'file-alt',
      iconColor: 'text-indigo-500 dark:text-indigo-400',
      iconBg: 'bg-indigo-50 dark:bg-indigo-950/35',
    };
  }

  if (key === 'welcome') {
    return {
      icon: 'heart',
      iconColor: 'text-pink-500 dark:text-pink-400',
      iconBg: 'bg-pink-50 dark:bg-pink-950/35',
    };
  }

  return {
    icon: 'bell',
    iconColor: 'text-slate-400 dark:text-slate-500',
    iconBg: 'bg-gray-50 dark:bg-slate-800/60',
  };
}

/** 서버 시각(YYYY-MM-DD HH:mm:ss) → 상대 시각 라벨 */
export function formatNotificationRelativeTime(
  createdAt: string | null | undefined,
  now = Date.now(),
): string {
  if (!createdAt) {
    return '';
  }

  const parsed = Date.parse(createdAt.replace(' ', 'T'));
  if (Number.isNaN(parsed)) {
    return createdAt;
  }

  const diffSec = Math.round((parsed - now) / 1000);
  const abs = Math.abs(diffSec);

  if (abs < 45) {
    return 'just_now';
  }
  if (abs < 3600) {
    return `minutes:${Math.max(1, Math.round(abs / 60))}`;
  }
  if (abs < 86400) {
    return `hours:${Math.max(1, Math.round(abs / 3600))}`;
  }
  if (abs < 604800) {
    return `days:${Math.max(1, Math.round(abs / 86400))}`;
  }

  return createdAt.slice(0, 10);
}

export function resolveRelativeTimeLabel(
  token: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (token === 'just_now') {
    return t('moa_shell.right.notification_time_just_now');
  }
  const [unit, raw] = token.split(':');
  const value = Number(raw);
  if (unit === 'minutes') {
    return t('moa_shell.right.notification_time_minutes', { count: value });
  }
  if (unit === 'hours') {
    return t('moa_shell.right.notification_time_hours', { count: value });
  }
  if (unit === 'days') {
    return t('moa_shell.right.notification_time_days', { count: value });
  }
  return token;
}
