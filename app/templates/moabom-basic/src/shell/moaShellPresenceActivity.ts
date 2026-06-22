import type { MoabomTranslateFn } from '../i18n/moabomT';
import type { MyPageTab } from '../components/composite/mypage/myPageTypes';
import { parseShellRoute } from '../utils/moabomShellRoutes';
import { readShellPresenceForeground, type ShellPresenceForeground } from './moaShellPresenceBridge';

const MYPAGE_TAB_KEYS: Record<MyPageTab, string> = {
  profile: 'moa_shell.presence.activity_mypage_profile',
  settings: 'moa_shell.presence.activity_mypage_settings',
  credit: 'moa_shell.presence.activity_mypage_credit',
  library: 'moa_shell.presence.activity_mypage_library',
  activity: 'moa_shell.presence.activity_mypage_activity',
  account: 'moa_shell.presence.activity_mypage_account',
  subscription: 'moa_shell.presence.activity_mypage_subscription',
};

function resolveFromForeground(t: MoabomTranslateFn, foreground: ShellPresenceForeground): string | null {
  if (foreground.boardSlug) {
    if (foreground.boardMode === 'write') {
      return t('moa_shell.presence.activity_board_write', { slug: foreground.boardSlug });
    }
    if (foreground.boardMode === 'edit') {
      return t('moa_shell.presence.activity_board_edit', { slug: foreground.boardSlug });
    }
    if (foreground.boardPostId) {
      return t('moa_shell.presence.activity_board_post', { slug: foreground.boardSlug });
    }
    return t('moa_shell.presence.activity_board', { slug: foreground.boardSlug });
  }

  if (foreground.userProfileUuid) {
    return t('moa_shell.presence.activity_profile');
  }

  if (foreground.myPageInitialTab) {
    const key = MYPAGE_TAB_KEYS[foreground.myPageInitialTab];
    return key ? t(key) : t('moa_shell.presence.activity_mypage_profile');
  }

  if (foreground.title) {
    return t('moa_shell.presence.activity_app', { title: foreground.title });
  }

  return null;
}

export function resolveShellPresenceActivityText(t: MoabomTranslateFn): string {
  if (typeof window === 'undefined') {
    return t('moa_shell.presence.activity_home');
  }

  const foreground = readShellPresenceForeground();
  const route = parseShellRoute(window.location.pathname, window.location.search);

  if (route.kind === 'home' && foreground) {
    const fromForeground = resolveFromForeground(t, foreground);
    if (fromForeground) {
      return fromForeground;
    }
  }

  switch (route.kind) {
    case 'board':
      if (route.boardMode === 'write') {
        return t('moa_shell.presence.activity_board_write', { slug: route.slug });
      }
      if (route.boardMode === 'edit') {
        return t('moa_shell.presence.activity_board_edit', { slug: route.slug });
      }
      if (route.postId) {
        return t('moa_shell.presence.activity_board_post', { slug: route.slug });
      }
      return t('moa_shell.presence.activity_board', { slug: route.slug });
    case 'userProfile':
      return t('moa_shell.presence.activity_profile');
    case 'me': {
      const key = MYPAGE_TAB_KEYS[route.tab];
      return key ? t(key) : t('moa_shell.presence.activity_mypage_profile');
    }
    case 'app':
      if (foreground?.title && foreground.appId === route.appId) {
        return t('moa_shell.presence.activity_app', { title: foreground.title });
      }
      return t('moa_shell.presence.activity_app_generic');
    case 'auth':
      return t('moa_shell.presence.activity_auth');
    case 'home':
    default:
      return t('moa_shell.presence.activity_home');
  }
}
