import type { CSSProperties } from 'react';
import { createShellAppMetadata } from '../_shared/createShellAppMetadata';

const SMART_CHAT_TEAL = '#14b8a6';
const SMART_CHAT_SKY = '#0ea5e9';

/** AI 스마트챗 악센트 — create-app(violet/pink)과 대비되는 푸른 그린 */
export const smartChatShellAccent = {
  primary: SMART_CHAT_TEAL,
  secondary: SMART_CHAT_SKY,
} as const;

export const smartChatShellMetadata = createShellAppMetadata({
  id: 'ai-smart-chat',
  icon: 'comments',
  gradient: `linear-gradient(135deg,${SMART_CHAT_TEAL},${SMART_CHAT_SKY})`,
  strings: {
    ko: { name: 'AI 스마트챗', description: 'AI와 대화하기' },
    en: { name: 'AI Smart Chat', description: 'Chat with AI' },
    ja: { name: 'AIスマートチャット', description: 'AIと会話する' },
    zh: { name: 'AI智能聊天', description: '与AI对话' },
  },
});

/** 회전 링·타이틀바 — create-app 아이콘/타이틀 CSS 토큰 재사용 */
export function getSmartChatShellCssVars(): CSSProperties {
  return {
    ['--create-app-spin-a' as string]: smartChatShellAccent.primary,
    ['--create-app-spin-b' as string]: smartChatShellAccent.secondary,
    ['--create-app-inner-bg' as string]: smartChatShellMetadata.gradient,
    ['--create-app-title-gradient' as string]: smartChatShellMetadata.gradient,
  };
}
