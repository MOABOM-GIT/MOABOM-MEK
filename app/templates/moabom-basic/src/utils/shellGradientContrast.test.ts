import { describe, expect, it } from 'vitest';
import { WEBSITE_LINK_APP_GRADIENT } from '../apps/ai-generator/websiteLinkApp';
import { isLightShellGradient } from './shellGradientContrast';

describe('shellGradientContrast', () => {
  it('detects light website-link gradients', () => {
    expect(isLightShellGradient(WEBSITE_LINK_APP_GRADIENT)).toBe(true);
  });

  it('treats typical saturated app gradients as dark chrome', () => {
    expect(isLightShellGradient('linear-gradient(135deg,#6366f1,#8b5cf6)')).toBe(false);
    expect(isLightShellGradient('linear-gradient(135deg,#06b6d4,#2563eb)')).toBe(false);
  });

  it('defaults to dark chrome when colors cannot be parsed', () => {
    expect(isLightShellGradient('linear-gradient(135deg, var(--moa-point-color), white)')).toBe(false);
    expect(isLightShellGradient(undefined)).toBe(false);
  });

  it('detects mixed gradients with a light average', () => {
    expect(isLightShellGradient('linear-gradient(135deg,#ffffff,#e2e8f0)')).toBe(true);
  });
});
