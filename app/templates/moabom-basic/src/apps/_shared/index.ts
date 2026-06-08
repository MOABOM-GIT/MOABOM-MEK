/**
 * 셸 앱 공용 SDK (`_shared`) — 신규 앱이 재사용하는 프리미티브 모음.
 *
 * 포함: 통화/숫자 포맷, 전자서명 패드, 탭 셸. API 클라이언트는 `src/api/moabomModuleApi.ts`.
 */
export { formatKrwManwon } from './format';
export { SignaturePad, type SignaturePadHandle } from './SignaturePad';
export { AppTabsShell, type AppTab } from './AppTabsShell';
