export type LiquidGlassBackdropTone = 'light' | 'dark';

export const LIQUID_GLASS_ON_LIGHT_CLASS = 'liquid-glass--on-light';
export const LIQUID_GLASS_ON_DARK_CLASS = 'liquid-glass--on-dark';

type RgbColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

const BACKDROP_SELECTOR_RE = /(^|[\s>+~.#:])(html|body|root|app|main|page|screen|viewport|wrapper|container)\b/;
const CSS_COMMENT_RE = /\/\*[\s\S]*?\*\//g;
const STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
const STYLE_RULE_RE = /([^{}]+)\{([^{}]+)\}/g;
const BACKGROUND_DECL_RE = /\bbackground(?:-color)?\s*:\s*([^;{}]+)/gi;
const HEX_COLOR_RE = /#[\da-f]{3,8}\b/gi;
const RGB_COLOR_RE = /rgba?\(([^)]+)\)/gi;
const HSL_COLOR_RE = /hsla?\(([^)]+)\)/gi;
const ROOTISH_ID_RE = /^(root|app|main|page|screen|viewport|wrapper|container)$/i;
const ROOTISH_CLASS_RE = /(^|[\s:])(root|app|main|page|screen|viewport|wrapper|container|min-h-screen|h-screen|fixed|inset-0)(\s|$)/i;
const TAILWIND_SHADE_HEX: Record<string, string> = {
  '50': '#f8fafc',
  '100': '#f1f5f9',
  '200': '#e2e8f0',
  '300': '#cbd5e1',
  '400': '#94a3b8',
  '500': '#64748b',
  '600': '#475569',
  '700': '#334155',
  '800': '#1e293b',
  '900': '#0f172a',
  '950': '#020617',
};

const NAMED_COLORS: Record<string, RgbColor> = {
  black: { r: 0, g: 0, b: 0, a: 1 },
  white: { r: 255, g: 255, b: 255, a: 1 },
  slate: { r: 15, g: 23, b: 42, a: 1 },
  gray: { r: 107, g: 114, b: 128, a: 1 },
  grey: { r: 107, g: 114, b: 128, a: 1 },
  zinc: { r: 39, g: 39, b: 42, a: 1 },
  neutral: { r: 38, g: 38, b: 38, a: 1 },
  stone: { r: 41, g: 37, b: 36, a: 1 },
  red: { r: 239, g: 68, b: 68, a: 1 },
  orange: { r: 249, g: 115, b: 22, a: 1 },
  amber: { r: 245, g: 158, b: 11, a: 1 },
  yellow: { r: 234, g: 179, b: 8, a: 1 },
  lime: { r: 132, g: 204, b: 22, a: 1 },
  green: { r: 34, g: 197, b: 94, a: 1 },
  emerald: { r: 16, g: 185, b: 129, a: 1 },
  teal: { r: 20, g: 184, b: 166, a: 1 },
  cyan: { r: 6, g: 182, b: 212, a: 1 },
  sky: { r: 14, g: 165, b: 233, a: 1 },
  blue: { r: 59, g: 130, b: 246, a: 1 },
  indigo: { r: 99, g: 102, b: 241, a: 1 },
  violet: { r: 139, g: 92, b: 246, a: 1 },
  purple: { r: 168, g: 85, b: 247, a: 1 },
  fuchsia: { r: 217, g: 70, b: 239, a: 1 },
  pink: { r: 236, g: 72, b: 153, a: 1 },
  rose: { r: 244, g: 63, b: 94, a: 1 },
};

export function liquidGlassBackdropClassName(tone: LiquidGlassBackdropTone | null | undefined): string {
  return tone === 'dark' ? LIQUID_GLASS_ON_DARK_CLASS : LIQUID_GLASS_ON_LIGHT_CLASS;
}

export function resolveLiquidGlassBackdropToneFromHtml(html: string | null | undefined): LiquidGlassBackdropTone | null {
  const candidates = collectBackdropColorCandidates(html);

  for (const candidate of candidates) {
    const tone = resolveLiquidGlassBackdropToneFromCssValue(candidate);
    if (tone) {
      return tone;
    }
  }

  return null;
}

export function resolveLiquidGlassBackdropToneFromCssValue(value: string): LiquidGlassBackdropTone | null {
  const colors = collectColorsFromCssValue(value);
  if (colors.length === 0) {
    return null;
  }

  const luminance = colors
    .map(color => relativeLuminance(compositeOnWhite(color)))
    .reduce((sum, item) => sum + item, 0) / colors.length;

  const blackContrast = contrastRatio(luminance, 0);
  const whiteContrast = contrastRatio(luminance, 1);

  return blackContrast >= whiteContrast ? 'light' : 'dark';
}

function collectBackdropColorCandidates(html: string | null | undefined): string[] {
  if (!html) {
    return [];
  }

  const source = html.replace(CSS_COMMENT_RE, '');
  const candidates: string[] = [];

  candidates.push(...readTagStyleBackgrounds(source, 'body'));
  candidates.push(...readTagStyleBackgrounds(source, 'html'));

  const styleCandidates: string[] = [];
  for (const match of source.matchAll(STYLE_BLOCK_RE)) {
    styleCandidates.push(...readBackdropRuleBackgrounds(match[1] ?? ''));
  }
  candidates.push(...styleCandidates.reverse());
  candidates.push(...readBackdropClassBackgrounds(source));

  const themeColor = readMetaThemeColor(source);
  if (themeColor) {
    candidates.push(themeColor);
  }

  return uniqueNonEmpty(candidates);
}

function readTagStyleBackgrounds(html: string, tagName: 'html' | 'body'): string[] {
  const tagRe = new RegExp(`<${tagName}\\b([^>]*)>`, 'i');
  const attrs = html.match(tagRe)?.[1] ?? '';
  const style = attrs.match(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/i)?.[2] ?? '';

  return readBackgroundDeclarations(style).reverse();
}

function readBackdropRuleBackgrounds(css: string): string[] {
  const candidates: string[] = [];

  for (const match of css.matchAll(STYLE_RULE_RE)) {
    const selector = (match[1] ?? '').trim().toLowerCase();
    const body = match[2] ?? '';
    if (!selector || !BACKDROP_SELECTOR_RE.test(selector)) {
      continue;
    }
    candidates.push(...readBackgroundDeclarations(body));
  }

  return candidates;
}

function readBackdropClassBackgrounds(html: string): string[] {
  const candidates: string[] = [];

  for (const match of html.matchAll(/<([a-z][\w:-]*)\b([^>]*)>/gi)) {
    const tagName = (match[1] ?? '').toLowerCase();
    const attrs = match[2] ?? '';
    const className = readHtmlAttribute(attrs, 'class');
    if (!className || !isRootishElement(tagName, attrs, className)) {
      continue;
    }
    candidates.push(...readTailwindBackgroundClasses(className));
  }

  return candidates.reverse();
}

function isRootishElement(tagName: string, attrs: string, className: string): boolean {
  if (tagName === 'html' || tagName === 'body' || tagName === 'main') {
    return true;
  }

  const id = readHtmlAttribute(attrs, 'id');
  return ROOTISH_ID_RE.test(id) || ROOTISH_CLASS_RE.test(className);
}

function readHtmlAttribute(attrs: string, name: string): string {
  const attrRe = new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i');
  return attrs.match(attrRe)?.[2]?.trim() ?? '';
}

function readTailwindBackgroundClasses(className: string): string[] {
  const colors: string[] = [];

  for (const raw of className.split(/\s+/)) {
    const token = normalizeTailwindUtilityToken(raw);
    if (!token) {
      continue;
    }

    const color = resolveTailwindBackgroundToken(token);
    if (color) {
      colors.push(color);
    }
  }

  return colors.length > 1 ? [`linear-gradient(135deg, ${colors.join(', ')})`] : colors;
}

function normalizeTailwindUtilityToken(raw: string): string | null {
  const token = raw.trim().replace(/^!/, '');
  if (!token || token.includes(':')) {
    return null;
  }

  return token;
}

function resolveTailwindBackgroundToken(token: string): string | null {
  const arbitrary = token.match(/^(?:bg|from|via|to)-\[(.+)]$/)?.[1];
  if (arbitrary) {
    if (/^url\(/i.test(arbitrary)) {
      return null;
    }
    return arbitrary.replace(/_/g, ' ');
  }

  if (!/^(?:bg|from|via|to)-/.test(token) || token.startsWith('bg-gradient-')) {
    return null;
  }

  const colorToken = token
    .replace(/^(?:bg|from|via|to)-/, '')
    .replace(/\/[\d.]+$/, '');

  if (colorToken === 'transparent' || colorToken === 'current' || colorToken === 'inherit') {
    return null;
  }
  if (colorToken === 'white' || colorToken === 'black') {
    return colorToken;
  }

  const shade = colorToken.match(/-(50|100|200|300|400|500|600|700|800|900|950)$/)?.[1];
  return shade ? TAILWIND_SHADE_HEX[shade] ?? null : NAMED_COLORS[colorToken] ? colorToken : null;
}

function readMetaThemeColor(html: string): string {
  const metaRe = /<meta\b(?=[^>]*\bname\s*=\s*(["'])theme-color\1)([^>]*)>/i;
  const attrs = html.match(metaRe)?.[2] ?? '';

  return attrs.match(/\bcontent\s*=\s*(["'])([^"']+)\1/i)?.[2]?.trim() ?? '';
}

function readBackgroundDeclarations(css: string): string[] {
  const values: string[] = [];

  for (const match of css.matchAll(BACKGROUND_DECL_RE)) {
    const value = (match[1] ?? '').trim();
    if (!value || value === 'transparent' || value.startsWith('url(')) {
      continue;
    }
    values.push(value);
  }

  return values;
}

function collectColorsFromCssValue(value: string): RgbColor[] {
  const colors: RgbColor[] = [];
  const varFallbacks = [...value.matchAll(/var\([^,]+,\s*([^)]+)\)/gi)]
    .flatMap(match => collectColorsFromCssValue(match[1] ?? ''));

  colors.push(...varFallbacks);

  for (const match of value.matchAll(HEX_COLOR_RE)) {
    const color = parseHexColor(match[0]);
    if (color) {
      colors.push(color);
    }
  }

  for (const match of value.matchAll(RGB_COLOR_RE)) {
    const color = parseRgbColor(match[1] ?? '');
    if (color) {
      colors.push(color);
    }
  }

  for (const match of value.matchAll(HSL_COLOR_RE)) {
    const color = parseHslColor(match[1] ?? '');
    if (color) {
      colors.push(color);
    }
  }

  const tokens = value.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  for (const token of tokens) {
    const color = NAMED_COLORS[token];
    if (color) {
      colors.push(color);
    }
  }

  return colors;
}

function parseHexColor(value: string): RgbColor | null {
  const hex = value.slice(1);

  if (hex.length === 3 || hex.length === 4) {
    const [r, g, b, a = 'f'] = hex.split('');
    return {
      r: parseInt(`${r}${r}`, 16),
      g: parseInt(`${g}${g}`, 16),
      b: parseInt(`${b}${b}`, 16),
      a: parseInt(`${a}${a}`, 16) / 255,
    };
  }

  if (hex.length === 6 || hex.length === 8) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
    };
  }

  return null;
}

function parseRgbColor(value: string): RgbColor | null {
  const parts = splitCssColorArgs(value);
  if (parts.length < 3) {
    return null;
  }

  const r = parseRgbComponent(parts[0]);
  const g = parseRgbComponent(parts[1]);
  const b = parseRgbComponent(parts[2]);
  const a = parts[3] ? parseAlpha(parts[3]) : 1;

  if ([r, g, b, a].some(item => item === null)) {
    return null;
  }

  return {
    r: r ?? 0,
    g: g ?? 0,
    b: b ?? 0,
    a: a ?? 1,
  };
}

function parseHslColor(value: string): RgbColor | null {
  const parts = splitCssColorArgs(value);
  if (parts.length < 3) {
    return null;
  }

  const h = parseFloat(parts[0] ?? '');
  const s = parsePercent(parts[1] ?? '');
  const l = parsePercent(parts[2] ?? '');
  const a = parts[3] ? parseAlpha(parts[3]) : 1;

  if (!Number.isFinite(h) || !Number.isFinite(s) || !Number.isFinite(l) || a === null || !Number.isFinite(a)) {
    return null;
  }

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [rp, gp, bp] = h < 60
    ? [c, x, 0]
    : h < 120
      ? [x, c, 0]
      : h < 180
        ? [0, c, x]
        : h < 240
          ? [0, x, c]
          : h < 300
            ? [x, 0, c]
            : [c, 0, x];

  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
    a,
  };
}

function splitCssColorArgs(value: string): string[] {
  return value
    .trim()
    .replace(/\s*\/\s*/g, ' ')
    .replace(/,/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function parseRgbComponent(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = value.endsWith('%')
    ? (parseFloat(value) / 100) * 255
    : parseFloat(value);

  return Number.isFinite(parsed) ? clamp(Math.round(parsed), 0, 255) : null;
}

function parsePercent(value: string): number {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return Number.NaN;
  }

  return value.endsWith('%') ? clamp(parsed / 100, 0, 1) : clamp(parsed, 0, 1);
}

function parseAlpha(value: string): number | null {
  const parsed = value.endsWith('%')
    ? parseFloat(value) / 100
    : parseFloat(value);

  return Number.isFinite(parsed) ? clamp(parsed, 0, 1) : null;
}

function compositeOnWhite(color: RgbColor): RgbColor {
  const alpha = clamp(color.a, 0, 1);

  return {
    r: color.r * alpha + 255 * (1 - alpha),
    g: color.g * alpha + 255 * (1 - alpha),
    b: color.b * alpha + 255 * (1 - alpha),
    a: 1,
  };
}

function relativeLuminance(color: RgbColor): number {
  const [r, g, b] = [color.r, color.g, color.b].map(channel => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrastRatio(luminanceA: number, luminanceB: number): number {
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);

  return (lighter + 0.05) / (darker + 0.05);
}

function uniqueNonEmpty(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    unique.push(normalized);
  }

  return unique;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
