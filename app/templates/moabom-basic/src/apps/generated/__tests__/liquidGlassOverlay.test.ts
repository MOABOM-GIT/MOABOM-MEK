import { describe, expect, it } from 'vitest';
import {
  buildIframeBackdropProbePoints,
  generatedAppLiquidGlassSurfaceClass,
  liquidGlassOverlayClass,
  MOA_LIQUID_GLASS_CHIP_CLASS,
  MOA_LIQUID_GLASS_SURFACE_CLASS,
  parseBackdropToneMessage,
} from '../liquidGlassOverlay';

describe('liquidGlassOverlay', () => {
  it('builds liquid-glass + tone + role classes', () => {
    expect(liquidGlassOverlayClass(null)).toBe('liquid-glass liquid-glass--on-light');
    expect(liquidGlassOverlayClass('dark', MOA_LIQUID_GLASS_CHIP_CLASS, 'generated-app-owner-button')).toBe(
      'liquid-glass liquid-glass--on-dark moa-liquid-glass-chip generated-app-owner-button',
    );
    expect(liquidGlassOverlayClass('light', MOA_LIQUID_GLASS_SURFACE_CLASS, 'generated-app-side-panel')).toBe(
      'liquid-glass liquid-glass--on-light moa-liquid-glass-surface generated-app-side-panel',
    );
  });

  it('keeps generatedAppLiquidGlassSurfaceClass as a thin alias', () => {
    expect(generatedAppLiquidGlassSurfaceClass(null)).toBe('liquid-glass liquid-glass--on-light');
    expect(generatedAppLiquidGlassSurfaceClass('dark', 'generated-app-side-panel')).toBe(
      'liquid-glass liquid-glass--on-dark generated-app-side-panel',
    );
  });

  it('parses backdrop-tone messages', () => {
    expect(parseBackdropToneMessage({
      source: 'moabom-app',
      type: 'backdrop-tone',
      tone: 'dark',
    })).toBe('dark');
    expect(parseBackdropToneMessage({
      source: 'moabom-app',
      type: 'backdrop-tone',
      tone: 'mid',
    })).toBeNull();
  });

  it('maps anchor rect to iframe probe points', () => {
    const iframe = {
      getBoundingClientRect: () => ({
        left: 100,
        top: 50,
        width: 400,
        height: 300,
        right: 500,
        bottom: 350,
      }),
    } as HTMLIFrameElement;
    const anchor = {
      getBoundingClientRect: () => ({
        left: 120,
        top: 300,
        width: 80,
        height: 32,
        right: 200,
        bottom: 332,
      }),
    } as HTMLElement;

    const points = buildIframeBackdropProbePoints(iframe, anchor, 'bottom-left');
    expect(points).toHaveLength(3);
    expect(points[0]).toEqual({ x: 60, y: 266 });
    expect(buildIframeBackdropProbePoints(iframe, null, 'top-left')).toEqual([{ x: 28, y: 28 }]);
    expect(buildIframeBackdropProbePoints(iframe, null, 'bottom-left')).toEqual([{ x: 28, y: 272 }]);
  });
});
