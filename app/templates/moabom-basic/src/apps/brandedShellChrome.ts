import type { CSSProperties } from 'react';
import { createAppShellMetadata, getCreateAppShellCssVars } from './ai-generator/metadata';
import { getSmartChatShellCssVars, smartChatShellMetadata } from './ai-smart-chat/metadata';

/** create-app · AI 스마트챗 — 회전 링·타이틀바 브랜드 크롬 */
export function isBrandedShellAppId(appId: string): boolean {
  return appId === createAppShellMetadata.id || appId === smartChatShellMetadata.id;
}

export function getBrandedShellCssVars(appId: string): CSSProperties | undefined {
  if (appId === createAppShellMetadata.id) return getCreateAppShellCssVars();
  if (appId === smartChatShellMetadata.id) return getSmartChatShellCssVars();
  return undefined;
}

export function brandedTitleBarVariant(
  appId: string,
): 'default' | 'create-app' | 'smart-chat' {
  if (appId === createAppShellMetadata.id) return 'create-app';
  if (appId === smartChatShellMetadata.id) return 'smart-chat';
  return 'default';
}

export function brandedAppIconClassName(appId: string): string {
  return isBrandedShellAppId(appId) ? 'create-app-icon' : '';
}

export function brandedTitleGradientClassName(appId: string): string {
  return isBrandedShellAppId(appId) ? 'create-app-title-gradient' : '';
}
