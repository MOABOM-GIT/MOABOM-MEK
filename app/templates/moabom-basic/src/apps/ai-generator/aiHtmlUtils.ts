import { generatedAppScrollbarCssRules } from './generatedAppScrollbarStyle';

// AI 생성 HTML 미리보기/저장 보안 정책 (C2 — deploy/PROJECT-ARCHITECTURE-HARDENING.md).
//
// iframe sandbox 에서 allow-same-origin 을 제거하면 미리보기는 opaque origin 이 되어
// 부모(셸) 출처의 쿠키/스토리지/DOM 에 접근할 수 없다(stored-XSS 차단의 핵심).
// 아래 CSP 메타는 심층 방어로, 자기완결 AI 앱(인라인 스크립트 + CDN)이 계속 동작하도록
// https CDN·인라인은 허용하되 base-uri/form 탈출 벡터를 제한한다.
//
// frame-ancestors 는 <meta> 로 전달하면 브라우저가 무시(콘솔 경고)하고, 본 미리보기는
// 셸이 의도적으로 sandbox iframe(opaque origin) 안에 프레이밍하므로 의미상으로도 맞지 않는다.
// 프레이밍 격리는 sandbox(allow-same-origin 제거)가 담당하므로 메타 CSP 에서는 제외한다.
export const AI_PREVIEW_CSP =
  "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; " +
  "script-src 'unsafe-inline' 'unsafe-eval' https: blob:; " +
  "style-src 'unsafe-inline' https:; " +
  "img-src 'self' data: blob: https:; " +
  "font-src 'self' data: https:; " +
  "media-src 'self' data: blob: https:; " +
  "connect-src https:; " +
  "base-uri 'none'; form-action 'self' https:;";

const SAFETY_CSP_META = `<meta http-equiv="Content-Security-Policy" content="${AI_PREVIEW_CSP}">`;

const SAFETY_STYLE = `
  <style id="moabom-ai-preview-safety">
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      height: auto !important;
      min-height: 100% !important;
      max-height: none !important;
      overflow: auto !important;
      overflow-y: auto !important;
    }
    canvas {
      max-width: 100% !important;
      max-height: 80vh !important;
    }
    [id*="chart"], [class*="chart"], .chart-container {
      max-height: 500px !important;
      position: relative !important;
    }
    ${generatedAppScrollbarCssRules()}
  </style>
`;

/** iframe srcdoc 에서 해시·탭 탈출을 유발하는 마크업 제거 (정적 sanitize). */
export function stripPreviewIncompatibleMarkup(html: string): string {
  return html
    .replace(/<script\b[^>]*\bid=["']moabom-ai-preview-runtime["'][^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<base\b[^>]*>/gi, '')
    .replace(/<link\b[^>]*\brel=["']manifest["'][^>]*>/gi, '');
}

export function injectAiPreviewSafety(html: string): string {
  if (!html) return '';

  const stripped = stripPreviewIncompatibleMarkup(html);
  if (stripped.includes('id="moabom-ai-preview-safety"')) {
    return stripped;
  }

  const headOpen = stripped.match(/<head[^>]*>/i);
  if (headOpen && stripped.includes('</head>')) {
    return stripped
      .replace(headOpen[0], `${headOpen[0]}${SAFETY_CSP_META}`)
      .replace('</head>', `${SAFETY_STYLE}</head>`);
  }
  if (stripped.includes('</head>')) {
    return stripped.replace('</head>', `${SAFETY_CSP_META}${SAFETY_STYLE}</head>`);
  }
  if (stripped.includes('<body')) {
    return stripped.replace('<body', `<head>${SAFETY_CSP_META}${SAFETY_STYLE}</head><body`);
  }

  return stripped;
}

export function extractCompleteHtml(input: string): string {
  const codeBlock = input.match(/```html\s*([\s\S]*?)\s*```/);
  const html = (codeBlock ? codeBlock[1] : input).trim();

  if (
    (html.includes('<!DOCTYPE html>') || html.includes('<html'))
    && html.includes('</html>')
    && html.includes('<head')
    && html.includes('</head>')
    && html.includes('<body')
    && html.includes('</body>')
  ) {
    return injectAiPreviewSafety(html);
  }

  return '';
}
