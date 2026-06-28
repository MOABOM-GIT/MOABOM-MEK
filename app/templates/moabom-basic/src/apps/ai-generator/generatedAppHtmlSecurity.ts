/**
 * AI 생성 앱 HTML 보안 스캔 (프론트).
 *
 * rule id·패턴 SSOT: `app/modules/moabom-apps/config/generated-app-html-security.php`
 * CDN(Three.js / Phaser / Chart.js) HTTPS 로드는 허용, 악성 의도 패턴만 차단합니다.
 */

export type GeneratedAppHtmlSecurityRuleId =
  | 'parent_shell_escape'
  | 'cookie_exfiltration'
  | 'javascript_protocol'
  | 'insecure_remote_script'
  | 'obfuscated_eval'
  | 'meta_refresh'
  | 'data_html_iframe';

export interface GeneratedAppHtmlSecurityViolation {
  ruleId: GeneratedAppHtmlSecurityRuleId;
}

export interface GeneratedAppHtmlSecurityScanResult {
  ok: boolean;
  violations: GeneratedAppHtmlSecurityViolation[];
}

const SECURITY_RULES: Array<{ id: GeneratedAppHtmlSecurityRuleId; pattern: RegExp }> = [
  {
    id: 'parent_shell_escape',
    pattern: /(\bparent\s*\.\s*(document|location|window|localStorage|sessionStorage)\b|\btop\s*\.\s*(document|location|window)\b|\bwindow\s*\.\s*(parent|top)\s*\.\s*(document|location)\b|\.frameElement\b)/i,
  },
  {
    id: 'cookie_exfiltration',
    pattern: /(document\s*\.\s*cookie[\s\S]{0,240}?(fetch\s*\(|sendBeacon\s*\(|XMLHttpRequest|\.src\s*=)|(?:fetch\s*\(|sendBeacon\s*\(|XMLHttpRequest)[\s\S]{0,240}?document\s*\.\s*cookie)/i,
  },
  {
    id: 'javascript_protocol',
    pattern: /javascript\s*:/i,
  },
  {
    id: 'insecure_remote_script',
    pattern: /\b(?:src|href)\s*=\s*["']http:\/\//i,
  },
  {
    id: 'obfuscated_eval',
    pattern: /\b(?:eval|new\s+Function)\s*\(\s*(?:atob|unescape|decodeURIComponent)\s*\(/i,
  },
  {
    id: 'meta_refresh',
    pattern: /<meta\b[^>]*http-equiv\s*=\s*["']refresh["'][^>]*>/i,
  },
  {
    id: 'data_html_iframe',
    pattern: /<iframe\b[^>]*\bsrc\s*=\s*["']data\s*:\s*text\/html/i,
  },
];

/** 실행 표면(스크립트 본문·이벤트 핸들러·위험 URL)만 추출합니다. */
export function extractGeneratedAppExecutableSurfaces(html: string): string[] {
  const surfaces: string[] = [];

  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = match[1] ?? '';
    const body = match[2] ?? '';
    const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (srcMatch?.[1]) {
      surfaces.push(`src="${srcMatch[1]}"`);
    }
    if (body.trim()) {
      surfaces.push(body);
    }
  }

  for (const match of html.matchAll(/\s(on[a-z]+)\s*=\s*("|')([\s\S]*?)\2/gi)) {
    if (match[3]) {
      surfaces.push(match[3]);
    }
  }

  for (const match of html.matchAll(/\b(href|src|action|formaction|data)\s*=\s*("|')([^"']*)\2/gi)) {
    if (match[3]) {
      surfaces.push(match[3]);
    }
  }

  const metaRefresh = html.match(/<meta\b[^>]*http-equiv\s*=\s*["']refresh["'][^>]*>/i);
  if (metaRefresh?.[0]) {
    surfaces.push(metaRefresh[0]);
  }

  for (const match of html.matchAll(/<iframe\b[^>]*>/gi)) {
    surfaces.push(match[0]);
  }

  return surfaces;
}

export function scanGeneratedAppHtmlSecurity(html: string): GeneratedAppHtmlSecurityScanResult {
  if (!html.trim()) {
    return { ok: true, violations: [] };
  }

  const violations: GeneratedAppHtmlSecurityViolation[] = [];
  const seen = new Set<GeneratedAppHtmlSecurityRuleId>();

  for (const surface of extractGeneratedAppExecutableSurfaces(html)) {
    for (const rule of SECURITY_RULES) {
      if (seen.has(rule.id)) {
        continue;
      }
      if (rule.pattern.test(surface)) {
        violations.push({ ruleId: rule.id });
        seen.add(rule.id);
      }
    }
  }

  return {
    ok: violations.length === 0,
    violations,
  };
}

export function formatGeneratedAppSecurityToast(
  violations: GeneratedAppHtmlSecurityViolation[],
  t: (key: string) => string,
): string {
  if (violations.length === 0) {
    return '';
  }

  const first = t(`moa_apps_ai.security.${violations[0].ruleId}`);
  if (violations.length === 1) {
    return first;
  }

  return `${first} ${t('moa_apps_ai.security.more', { count: String(violations.length - 1) })}`;
}
