import type { LiquidGlassBackdropTone } from '../../components/composite/liquidGlassBackdropTone';
import {
  liquidGlassBackdropClassName,
  resolveLiquidGlassBackdropToneFromHtml,
} from '../../components/composite/liquidGlassBackdropTone';

export type { LiquidGlassBackdropTone };

/**
 * iframe 위 liquid-glass 오버레이 공통 표면.
 *
 * 사용:
 *   className={liquidGlassOverlayClass(tone, MOA_LIQUID_GLASS_CHIP_CLASS, 'my-role')}
 *
 * - CHIP: 오너 칩·요소 선택 토글 등 pill 버튼
 * - SURFACE: 사이드 패널·인스펙터 바디 등 패널 표면(가독 색·헤일로)
 */
export const MOA_LIQUID_GLASS_CHIP_CLASS = 'moa-liquid-glass-chip';
export const MOA_LIQUID_GLASS_SURFACE_CLASS = 'moa-liquid-glass-surface';

export type IframeBackdropProbeCorner = 'top-left' | 'bottom-left';

export type IframeBackdropProbePoint = { x: number; y: number };

/**
 * liquid-glass + on-light|on-dark + 역할 클래스.
 * 톤이 없으면 on-light(짙은 글자) — 실측 probe 가 오기 전 폴백.
 */
export function liquidGlassOverlayClass(
  tone: LiquidGlassBackdropTone | null | undefined,
  ...extraClassNames: Array<string | null | undefined | false>
): string {
  const parts = ['liquid-glass', liquidGlassBackdropClassName(tone)];
  for (const extra of extraClassNames) {
    const trimmed = typeof extra === 'string' ? extra.trim() : '';
    if (trimmed) {
      parts.push(trimmed);
    }
  }
  return parts.join(' ');
}

/** @deprecated liquidGlassOverlayClass 사용 — 기존 import 호환 */
export function generatedAppLiquidGlassSurfaceClass(
  tone: LiquidGlassBackdropTone | null | undefined,
  extraClassName = '',
): string {
  return liquidGlassOverlayClass(tone, extraClassName);
}

export function resolveStaticBackdropTone(
  html: string | null | undefined,
): LiquidGlassBackdropTone | null {
  return resolveLiquidGlassBackdropToneFromHtml(html);
}

export function parseBackdropToneMessage(data: unknown): LiquidGlassBackdropTone | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const message = data as { source?: string; type?: string; tone?: string };
  if (message.source !== 'moabom-app' || message.type !== 'backdrop-tone') {
    return null;
  }
  if (message.tone === 'light' || message.tone === 'dark') {
    return message.tone;
  }
  return null;
}

/**
 * 앵커(칩/토글) 화면 좌표 → iframe 내부 probe 지점.
 * opaque-origin iframe 은 부모가 픽셀을 못 읽으므로 브릿지가 이 좌표로 측정한다.
 */
export function buildIframeBackdropProbePoints(
  iframe: HTMLIFrameElement,
  anchor: HTMLElement | null | undefined,
  fallbackCorner: IframeBackdropProbeCorner = 'bottom-left',
): IframeBackdropProbePoint[] {
  const frameRect = iframe.getBoundingClientRect();
  if (anchor) {
    const rect = anchor.getBoundingClientRect();
    const cy = rect.top - frameRect.top + rect.height / 2;
    return [
      { x: rect.left - frameRect.left + rect.width / 2, y: cy },
      { x: rect.left - frameRect.left + 6, y: cy },
      { x: rect.right - frameRect.left - 6, y: cy },
    ];
  }
  if (fallbackCorner === 'top-left') {
    return [{ x: 28, y: 28 }];
  }
  return [{ x: 28, y: Math.max(28, frameRect.height - 28) }];
}

export function postIframeBackdropProbe(
  iframe: HTMLIFrameElement | null | undefined,
  points?: IframeBackdropProbePoint[],
): void {
  const win = iframe?.contentWindow;
  if (!win) {
    return;
  }
  try {
    win.postMessage(
      {
        source: 'moabom-shell',
        type: 'backdrop-probe',
        id: Date.now(),
        points: points && points.length > 0 ? points : undefined,
      },
      '*',
    );
  } catch {
    /* opaque / unloaded iframe */
  }
}

export function requestIframeBackdropProbe(options: {
  iframe: HTMLIFrameElement | null | undefined;
  anchor?: HTMLElement | null;
  fallbackCorner?: IframeBackdropProbeCorner;
}): void {
  const { iframe, anchor, fallbackCorner = 'bottom-left' } = options;
  if (!iframe?.contentWindow) {
    return;
  }
  postIframeBackdropProbe(
    iframe,
    buildIframeBackdropProbePoints(iframe, anchor ?? null, fallbackCorner),
  );
}
