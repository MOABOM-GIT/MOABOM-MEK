/**
 * 셸 앱 그라데이션(타이틀 바·태스크바 pill) 위 텍스트/크롬 대비 SSOT.
 * `linear-gradient(...)` 문자열에서 색 stop 을 추출해 평균 휘도로 밝은 배경 여부를 판단합니다.
 * `var()`·`color-mix()` 등 해석 불가 값은 어두운 배경(흰 글자)으로 간주합니다.
 */

const LIGHT_LUMINANCE_THRESHOLD = 0.58;

type Rgb = { r: number; g: number; b: number };

function parseHexColor(raw: string): Rgb | null {
  const hex = raw.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    };
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  return null;
}

function parseRgbTriplet(raw: string): Rgb | null {
  const match = raw.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (!match) {
    return null;
  }
  return {
    r: Math.min(255, Math.max(0, Number(match[1]))),
    g: Math.min(255, Math.max(0, Number(match[2]))),
    b: Math.min(255, Math.max(0, Number(match[3]))),
  };
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function extractColorSamples(background: string): Rgb[] {
  const samples: Rgb[] = [];
  const hexMatches = background.matchAll(/#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/gi);
  for (const match of hexMatches) {
    const rgb = parseHexColor(match[0]);
    if (rgb) {
      samples.push(rgb);
    }
  }
  const rgbMatches = background.matchAll(/rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+[^)]*\)/gi);
  for (const match of rgbMatches) {
    const rgb = parseRgbTriplet(match[0]);
    if (rgb) {
      samples.push(rgb);
    }
  }
  return samples;
}

/** 타이틀 바·태스크바 pill 배경이 밝으면 true — 진한 글자/크롬 사용 */
export function isLightShellGradient(gradient?: string | null): boolean {
  const source = gradient?.trim();
  if (!source) {
    return false;
  }
  const colors = extractColorSamples(source);
  if (colors.length === 0) {
    return false;
  }
  const avg =
    colors.reduce((sum, color) => sum + relativeLuminance(color), 0) / colors.length;
  return avg >= LIGHT_LUMINANCE_THRESHOLD;
}

export type ShellChromeToneClasses = {
  icon: string;
  label: string;
  chromeBtn: string;
  favoriteIdle: string;
  favoriteStar: string;
};

/** 윈도우 타이틀 바·태스크바 공통 크롬 톤 클래스 */
export function shellChromeToneClasses(isLight: boolean): ShellChromeToneClasses {
  if (isLight) {
    return {
      icon: 'text-slate-800',
      label: 'text-slate-900',
      chromeBtn: 'bg-slate-900/10 hover:bg-slate-900/20',
      favoriteIdle: 'bg-slate-900/10 hover:bg-slate-900/20',
      favoriteStar: 'text-slate-900',
    };
  }
  return {
    icon: 'text-white',
    label: 'text-white',
    chromeBtn: 'bg-white/20 hover:bg-white/35',
    favoriteIdle: 'bg-white/20 hover:bg-white/35',
    favoriteStar: 'text-white',
  };
}
