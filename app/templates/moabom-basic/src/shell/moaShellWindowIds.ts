/**
 * 셸 가상 윈도우 appId SSOT barrel.
 * 윈도우 종류별 구현은 분리 파일에 두고, 셸 오케스트레이션(useMoaShellWindows·라우트 동기화)은 여기서만 import 한다.
 */
export {
  MOA_SHELL_BOARD_APP_ID_PREFIX,
  moaShellBoardAppId,
  moaShellBoardSlugFromAppId,
  isMoaShellBoardAppId,
} from './moaShellBoardIds';

export {
  APP_COMMUNITY_WINDOW_PREFIX,
  moaShellAppCommunityAppId,
  parseAppCommunityServerId,
  isMoaShellAppCommunityAppId,
} from './moaShellAppCommunityIds';

export {
  SHELL_PROFILE_SURFACE_APP_ID,
  isMoaShellUserProfileAppId,
  moaShellUserProfileUuidFromAppId,
} from './moaShellUserProfileIds';

export {
  MOA_SHELL_ERROR_APP_ID,
  isMoaShellErrorAppId,
} from './moaShellErrorIds';

export {
  MOA_SHELL_LEGAL_PAGE_PRIVACY_APP_ID,
  MOA_SHELL_LEGAL_PAGE_TERMS_APP_ID,
  moaShellLegalPageSlugFromAppId,
} from './moaShellLegalPageIds';
