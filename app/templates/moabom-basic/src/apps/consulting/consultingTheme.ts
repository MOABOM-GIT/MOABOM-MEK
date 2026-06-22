/** 스마트 컨설팅 앱 — Moabom 브랜드 팔레트 (패널 표면은 `APP_SHELL_PANEL_BODY_CLASS` SSOT) */
import { APP_SHELL_PANEL_BODY_CLASS } from '../appShellTypography';

export const CONSULTING_COLORS = {
  green: '#87c426',
  orange: '#fe8540',
  mint: '#27bfc1',
  blue: '#479ee2',
  ink: '#0f2d3a',
} as const;

export const CONSULTING_GRADIENT = `linear-gradient(135deg,${CONSULTING_COLORS.mint} 0%,${CONSULTING_COLORS.blue} 100%)`;

export const CONSULTING_ACCENT = 'text-[#87c426] dark:text-[#a7dd58]';

/** @deprecated `APP_SHELL_PANEL_BODY_CLASS` 직접 사용 권장 */
export const CONSULTING_PANEL = APP_SHELL_PANEL_BODY_CLASS;

export const CONSULTING_PRIMARY_CTA =
  '!border-transparent !bg-[#fe8540] !text-white shadow-md shadow-[#fe8540]/20 hover:!bg-[#e8732f]';

export const CONSULTING_ORANGE_TEXT = 'text-[#b4511e] dark:text-[#ffbf98]';
export const CONSULTING_MINT_TEXT = 'text-[#0f6f78] dark:text-[#9de7e8]';
