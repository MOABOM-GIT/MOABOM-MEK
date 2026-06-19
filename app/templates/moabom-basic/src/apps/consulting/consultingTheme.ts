/** 360 컨설팅 앱 — Moabom 브랜드 팔레트 */
export const CONSULTING_COLORS = {
  green: '#87c426',
  orange: '#fe8540',
  mint: '#27bfc1',
  blue: '#479ee2',
  ink: '#0f2d3a',
} as const;

export const CONSULTING_GRADIENT = `linear-gradient(135deg,${CONSULTING_COLORS.mint} 0%,${CONSULTING_COLORS.blue} 100%)`;

export const CONSULTING_ACCENT = 'text-[#87c426] dark:text-[#a7dd58]';

export const CONSULTING_PANEL =
  'moa-group rounded-[1.75rem] border border-[#27bfc1]/16 bg-white p-6 shadow-sm backdrop-blur-sm dark:border-[#27bfc1]/25 dark:bg-slate-900/70';

export const CONSULTING_HERO_GRADIENT =
  'border border-[#27bfc1]/25 bg-gradient-to-br from-[#27bfc1] to-[#479ee2] text-white';

export const CONSULTING_ICON_TILE =
  'flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#27bfc1] to-[#479ee2] text-white shadow-md shadow-[#27bfc1]/20';

export const CONSULTING_PRIMARY_CTA =
  '!border-transparent !bg-[#fe8540] !text-white shadow-md shadow-[#fe8540]/20 hover:!bg-[#e8732f]';

export const CONSULTING_ORANGE_TEXT = 'text-[#b4511e] dark:text-[#ffbf98]';
export const CONSULTING_MINT_TEXT = 'text-[#0f6f78] dark:text-[#9de7e8]';
