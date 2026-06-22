import { MOA_SHELL_NOTICE_BOARD_SLUG } from '../shell/moaShellNoticeBoard';
import {
  notifyShellNoticeBoardChanged,
  type ShellNoticeBoardChangeAction,
} from '../shell/moaShellNoticeBoardEvents';

const VALID_ACTIONS = new Set<ShellNoticeBoardChangeAction>(['created', 'updated', 'deleted']);

export async function notifyShellNoticeBoardChangedHandler(
  action: { params?: Record<string, unknown> },
): Promise<void> {
  const params = action?.params ?? {};
  const slug = String(params.slug ?? '').trim();
  if (slug !== MOA_SHELL_NOTICE_BOARD_SLUG) {
    return;
  }

  const rawAction = String(params.action ?? 'updated');
  const changeAction: ShellNoticeBoardChangeAction = VALID_ACTIONS.has(rawAction as ShellNoticeBoardChangeAction)
    ? (rawAction as ShellNoticeBoardChangeAction)
    : 'updated';

  const postId = params.postId != null && String(params.postId).trim() !== ''
    ? String(params.postId)
    : undefined;

  notifyShellNoticeBoardChanged({ slug, postId, action: changeAction });
}
