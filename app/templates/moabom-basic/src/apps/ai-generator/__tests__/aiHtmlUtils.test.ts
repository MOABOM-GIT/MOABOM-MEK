import { describe, expect, it } from 'vitest';
import { AI_PREVIEW_CSP, extractCompleteHtml, injectAiPreviewSafety } from '../aiHtmlUtils';

describe('AI 앱 HTML 유틸', () => {
  it('마크다운 HTML 코드 블록에서 완전한 HTML 문서를 추출한다', () => {
    const html = extractCompleteHtml(`\`\`\`html
<!DOCTYPE html><html><head><title>x</title></head><body>ok</body></html>
\`\`\``);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('moabom-ai-preview-safety');
  });

  it('이미 safety block이 있으면 중복 주입하지 않는다', () => {
    const html = '<html><head><style id="moabom-ai-preview-safety">html,body{margin:0}</style></head><body></body></html>';
    const out = injectAiPreviewSafety(html);

    expect(out).toBe(html);
    expect(out.match(/moabom-ai-preview-safety/g)?.length).toBe(1);
  });

  it('이미 주입된 preview runtime shim 은 제거한다', () => {
    const html = '<html><head><script id="moabom-ai-preview-runtime">throw new Error("disabled")</script><title>x</title></head><body></body></html>';
    const out = injectAiPreviewSafety(html);

    expect(out).not.toContain('moabom-ai-preview-runtime');
  });

  it('hosted 앱 runtime shim(moabom-app-runtime)도 제거한다', () => {
    const html = '<html><head><script id="moabom-app-runtime">window.__MOABOM_APP_RUNTIME__={}</script></head><body></body></html>';
    const out = injectAiPreviewSafety(html);

    expect(out).not.toContain('moabom-app-runtime');
  });

  it('<base> 태그와 PWA manifest 링크는 미리보기에서 제거한다', () => {
    const html = '<html><head><base href="https://mek360.com/app/generated-app-8"><link rel="manifest" href="/manifest.json"><title>x</title></head><body></body></html>';
    const out = injectAiPreviewSafety(html);

    expect(out).not.toContain('<base');
    expect(out).not.toContain('rel="manifest"');
    expect(out).toContain('moabom-ai-preview-safety');
  });

  it('CSP 메타를 head 시작부에 주입해 부모 출처 접근을 차단한다 (C2)', () => {
    const html = '<html><head><title>x</title></head><body>ok</body></html>';
    const out = injectAiPreviewSafety(html);

    expect(out).toContain('http-equiv="Content-Security-Policy"');
    expect(out).toContain(AI_PREVIEW_CSP);
    expect(out).not.toContain('frame-ancestors');
    expect(out).toContain("base-uri 'none'");
    expect(out.indexOf('Content-Security-Policy')).toBeLessThan(out.indexOf('moabom-ai-preview-safety'));
  });

  it('head 가 없고 body 만 있어도 CSP+safety 를 주입한다', () => {
    const html = '<body>ok</body>';
    const out = injectAiPreviewSafety(html);

    expect(out).toContain('http-equiv="Content-Security-Policy"');
    expect(out).toContain('moabom-ai-preview-safety');
  });

  it('미리보기 문서 전체가 iframe 내부에서 세로 스크롤될 수 있게 한다', () => {
    const html = '<html><head></head><body><main style="height:200vh">long</main></body></html>';
    const out = injectAiPreviewSafety(html);

    expect(out).toContain('min-height: 100% !important');
    expect(out).toContain('max-height: none !important');
    expect(out).toContain('overflow-y: auto !important');
  });

  it('전역 max-width 를 모든 요소에 걸지 않는다', () => {
    const html = '<html><head></head><body></body></html>';
    const out = injectAiPreviewSafety(html);

    expect(out).not.toMatch(/\*\s*\{[^}]*max-width:\s*100%/);
    expect(out).toContain('html, body');
    expect(out).toContain('max-width: 100%');
  });

  it('create-app 악센트 색으로 셸과 동일한 4px 스크롤바 스타일을 safety 블록에 주입한다', () => {
    const html = '<html><head></head><body></body></html>';
    const out = injectAiPreviewSafety(html);

    expect(out).toContain('::-webkit-scrollbar');
    expect(out).not.toContain('scrollbar-width');
    expect(out).toContain('width: 4px !important');
    expect(out).toContain('id="moabom-ai-preview-safety"');
  });

  it('AI 앱 본문 style 블록은 그대로 유지한다', () => {
    const html =
      '<html><head><style>.card{color:red}::-webkit-scrollbar{width:12px}</style></head><body></body></html>';
    const out = injectAiPreviewSafety(html);

    expect(out).toContain('.card{color:red}');
    expect(out).toContain('width:12px');
    expect(out).toContain('moabom-ai-preview-safety');
  });
});
