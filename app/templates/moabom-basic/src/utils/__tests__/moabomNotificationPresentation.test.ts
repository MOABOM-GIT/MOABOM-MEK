import { describe, expect, it } from 'vitest';
import {
  formatNotificationRelativeTime,
  getNotificationVisual,
  resolveRelativeTimeLabel,
} from '../moabomNotificationPresentation';

describe('moabomNotificationPresentation', () => {
  it('maps comment notifications to blue comment icon', () => {
    const visual = getNotificationVisual('new_comment');
    expect(visual.icon).toBe('comment');
    expect(visual.iconBg).toContain('blue');
  });

  it('formats recent timestamps as just_now', () => {
    const now = Date.parse('2026-06-19T12:00:00');
    expect(formatNotificationRelativeTime('2026-06-19 11:59:50', now)).toBe('just_now');
  });

  it('resolves relative time tokens via i18n callback', () => {
    const label = resolveRelativeTimeLabel('minutes:5', (key, params) => `${key}:${params?.count}`);
    expect(label).toBe('moa_shell.right.notification_time_minutes:5');
  });
});
