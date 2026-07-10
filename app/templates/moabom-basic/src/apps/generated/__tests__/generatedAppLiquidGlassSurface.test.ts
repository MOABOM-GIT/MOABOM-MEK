import { describe, expect, it } from 'vitest';
import { generatedAppLiquidGlassSurfaceClass } from '../generatedAppLiquidGlassSurface';
import { MOA_LIQUID_GLASS_CHIP_CLASS } from '../liquidGlassOverlay';

describe('generatedAppLiquidGlassSurfaceClass', () => {
  it('applies on-light by default and on-dark for dark tone', () => {
    expect(generatedAppLiquidGlassSurfaceClass(null)).toBe('liquid-glass liquid-glass--on-light');
    expect(generatedAppLiquidGlassSurfaceClass('dark', 'generated-app-side-panel')).toBe(
      'liquid-glass liquid-glass--on-dark generated-app-side-panel',
    );
  });

  it('re-exports chip class constant for overlay consumers', () => {
    expect(MOA_LIQUID_GLASS_CHIP_CLASS).toBe('moa-liquid-glass-chip');
  });
});
