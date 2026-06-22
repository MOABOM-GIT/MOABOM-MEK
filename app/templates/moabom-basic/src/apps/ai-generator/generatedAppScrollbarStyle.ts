import { createAppShellAccent } from './metadata';

/** AI 생성 앱 iframe 스크롤바 — `21-scrollbar.css` 와 동일(4px·track transparent·thumb 22%). */
export function generatedAppScrollbarCssRules(): string {
  const a = createAppShellAccent.primary;
  const b = createAppShellAccent.secondary;

  return `
    :root {
      --moabom-generated-app-scrollbar-color: color-mix(in srgb, ${a} 58%, ${b});
      --moabom-generated-app-scrollbar-thumb: color-mix(in srgb, var(--moabom-generated-app-scrollbar-color) 22%, transparent);
    }
    ::-webkit-scrollbar {
      width: 4px !important;
      height: 4px !important;
    }
    ::-webkit-scrollbar-track {
      background: transparent !important;
      margin: 8px 0 !important;
    }
    ::-webkit-scrollbar-thumb {
      background: var(--moabom-generated-app-scrollbar-thumb) !important;
      border-radius: 4px !important;
    }
  `.trim();
}
