import { describe, expect, it } from 'vitest';
import {
  liquidGlassBackdropClassName,
  resolveLiquidGlassBackdropToneFromCssValue,
  resolveLiquidGlassBackdropToneFromHtml,
} from './liquidGlassBackdropTone';

describe('liquidGlassBackdropTone', () => {
  it('chooses dark text for a light backdrop', () => {
    expect(resolveLiquidGlassBackdropToneFromCssValue('#f8fafc')).toBe('light');
    expect(liquidGlassBackdropClassName('light')).toBe('liquid-glass--on-light');
  });

  it('chooses white text for a dark backdrop', () => {
    expect(resolveLiquidGlassBackdropToneFromCssValue('linear-gradient(135deg, #020617, #1e293b)')).toBe('dark');
    expect(liquidGlassBackdropClassName('dark')).toBe('liquid-glass--on-dark');
  });

  it('reads body and root background declarations from saved HTML', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { background: #f8fafc; }
            #root { min-height: 100vh; background: rgb(15 23 42); }
          </style>
        </head>
        <body><div id="root"></div></body>
      </html>
    `;

    expect(resolveLiquidGlassBackdropToneFromHtml(html)).toBe('dark');
  });

  it('reads Tailwind-like backdrop classes from root containers', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <body class="bg-white">
          <div id="root" class="min-h-screen bg-slate-950"></div>
        </body>
      </html>
    `;

    expect(resolveLiquidGlassBackdropToneFromHtml(html)).toBe('dark');
  });

  it('reads Tailwind-like gradient stop classes', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <body class="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black"></body>
      </html>
    `;

    expect(resolveLiquidGlassBackdropToneFromHtml(html)).toBe('dark');
  });

  it('falls back to light-backdrop class when tone is unknown', () => {
    expect(liquidGlassBackdropClassName(null)).toBe('liquid-glass--on-light');
  });
});
