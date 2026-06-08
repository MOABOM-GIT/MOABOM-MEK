import type { CSSProperties } from 'react';
import type { App } from '../../data/Moa_apps';

const CREATE_APP_VIOLET = '#8b5cf6';
const CREATE_APP_PINK = '#ec4899';

/** 메인 그리드·create-app 창 타이틀 테두리 등 공통 악센트 */
export const createAppShellAccent = {
  primary: CREATE_APP_VIOLET,
  secondary: CREATE_APP_PINK,
} as const;

/**
 * 셸 전용「AI 앱 만들기」윈도우 메타 — `APPS` 목록에 넣지 않으며 그리드 타일·`appsById`·라우트만 연동합니다.
 */
export const createAppShellMetadata: App = {
  id: 'create-app',
  name: 'AI 앱 만들기',
  description: '프롬프트로 웹앱 만들기',
  icon: 'wand-magic-sparkles',
  gradient: `linear-gradient(135deg,${CREATE_APP_VIOLET},${CREATE_APP_PINK})`,
  category: 'basic',
  source: 'system',
};

export function getCreateAppShellCssVars(): CSSProperties {
  return {
    ['--create-app-spin-a' as string]: createAppShellAccent.primary,
    ['--create-app-spin-b' as string]: createAppShellAccent.secondary,
    ['--create-app-inner-bg' as string]: createAppShellMetadata.gradient,
    ['--create-app-title-gradient' as string]: createAppShellMetadata.gradient,
  };
}
