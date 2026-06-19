import { describe, expect, it } from 'vitest';
import {
  isShellNotificationUnread,
  shellNotificationReadTimestamp,
} from '../moabomShellNotificationUtils';

describe('moabomShellNotificationUtils', () => {
  it('shellNotificationReadTimestamp 는 Y-m-d H:i:s 형식이다', () => {
    expect(shellNotificationReadTimestamp(new Date('2026-06-19T12:34:56.000Z'))).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('isShellNotificationUnread 는 null·빈 문자열만 미읽음으로 본다', () => {
    expect(isShellNotificationUnread(null)).toBe(true);
    expect(isShellNotificationUnread('')).toBe(true);
    expect(isShellNotificationUnread('read')).toBe(false);
    expect(isShellNotificationUnread('2026-06-19 12:00:00')).toBe(false);
  });
});
