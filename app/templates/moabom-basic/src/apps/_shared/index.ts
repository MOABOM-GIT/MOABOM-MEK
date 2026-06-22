/**
 * 셸 앱 공용 SDK (`_shared`) — 신규 앱이 재사용하는 프리미티브 모음.
 *
 * 포함: 통화/숫자 포맷, 전자서명 패드, 탭 셸. API 클라이언트는 `src/api/moabomShellHttp.ts`.
 */
export { MOA_APP_WINDOW_CQ } from '../appWindowBreakpoints';
export { formatKrwManwon } from './format';
export { SignaturePad, type SignaturePadHandle } from './SignaturePad';
export { AppTabsShell, type AppTab } from './AppTabsShell';
export { AppWindowHeader, type AppWindowHeaderProps } from './AppWindowHeader';
export { APP_STACK_CLASS, APP_STACK_GRID_CLASS } from '../appShellTypography';
export { createShellAppMetadata } from './createShellAppMetadata';
export { PlaceholderAppShell, createPlaceholderApp } from './PlaceholderAppShell';
