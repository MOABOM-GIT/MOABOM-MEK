import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import type { LiquidGlassBackdropTone } from '../../components/composite/liquidGlassBackdropTone';
import {
  parseBackdropToneMessage,
  requestIframeBackdropProbe,
  resolveStaticBackdropTone,
  type IframeBackdropProbeCorner,
} from './liquidGlassOverlay';

export type UseIframeBackdropToneOptions = {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  /** false 면 probe·리스너 비활성 */
  enabled?: boolean;
  /** HTML 정적 톤 폴백 (probe 전·실패 시) */
  staticHtml?: string | null;
  /** 드래그 중이면 재측정 생략 */
  isDragging?: boolean;
  /** 변경 시 probedTone 리셋 + 재측정 (frameUrl / previewHtml) */
  contentKey?: string | null;
  /** probe 앵커(칩·토글). 없으면 fallbackCorner */
  getAnchorElement?: () => HTMLElement | null;
  fallbackCorner?: IframeBackdropProbeCorner;
  /** contentKey 변경 후 첫 probe 지연(ms) */
  probeDelayMs?: number;
  /** 실측 톤 수신 시 (예: 뷰어 frame-ready) */
  onProbedTone?: (tone: LiquidGlassBackdropTone) => void;
};

/**
 * iframe backdrop-probe 실측 + HTML 정적 폴백.
 * 오너 칩·요소 선택·사이드 패널이 같은 톤 파이프라인을 쓴다.
 */
export function useIframeBackdropTone({
  iframeRef,
  enabled = true,
  staticHtml = null,
  isDragging = false,
  contentKey = null,
  getAnchorElement,
  fallbackCorner = 'bottom-left',
  probeDelayMs = 140,
  onProbedTone,
}: UseIframeBackdropToneOptions) {
  const [probedTone, setProbedTone] = useState<LiquidGlassBackdropTone | null>(null);

  const staticTone = useMemo(
    () => resolveStaticBackdropTone(staticHtml),
    [staticHtml],
  );
  const tone = probedTone ?? staticTone;

  const requestBackdropProbe = useCallback(() => {
    if (!enabled) {
      return;
    }
    requestIframeBackdropProbe({
      iframe: iframeRef.current,
      anchor: getAnchorElement?.() ?? null,
      fallbackCorner,
    });
  }, [enabled, iframeRef, getAnchorElement, fallbackCorner]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      const next = parseBackdropToneMessage(event.data);
      if (next) {
        setProbedTone(next);
        onProbedTone?.(next);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [enabled, iframeRef, onProbedTone]);

  useEffect(() => {
    if (!enabled) {
      setProbedTone(null);
      return;
    }
    if (isDragging || !contentKey) {
      return;
    }
    setProbedTone(null);
    const timer = window.setTimeout(requestBackdropProbe, probeDelayMs);
    const iframe = iframeRef.current;
    const onLoad = () => {
      window.setTimeout(requestBackdropProbe, 80);
    };
    iframe?.addEventListener('load', onLoad);
    return () => {
      window.clearTimeout(timer);
      iframe?.removeEventListener('load', onLoad);
    };
  }, [enabled, isDragging, contentKey, iframeRef, requestBackdropProbe, probeDelayMs]);

  return {
    tone,
    probedTone,
    staticTone,
    setProbedTone,
    requestBackdropProbe,
  };
}
