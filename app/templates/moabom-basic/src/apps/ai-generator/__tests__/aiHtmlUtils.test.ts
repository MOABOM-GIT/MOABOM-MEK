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
    const html = '<html><head><style id="moabom-ai-preview-safety"></style></head><body></body></html>';

    expect(injectAiPreviewSafety(html)).toBe(html);
  });

  it('CSP 메타를 head 시작부에 주입해 부모 출처 접근을 차단한다 (C2)', () => {
    const html = '<html><head><title>x</title></head><body>ok</body></html>';
    const out = injectAiPreviewSafety(html);

    expect(out).toContain('http-equiv="Content-Security-Policy"');
    expect(out).toContain(AI_PREVIEW_CSP);
    expect(out).toContain("frame-ancestors 'none'");
    // CSP 는 style(head 끝) 보다 앞에 와야 이후 리소스를 통제한다.
    expect(out.indexOf('Content-Security-Policy')).toBeLessThan(out.indexOf('moabom-ai-preview-safety'));
  });

  it('head 가 없고 body 만 있어도 CSP+safety 를 주입한다', () => {
    const html = '<body>ok</body>';
    const out = injectAiPreviewSafety(html);

    expect(out).toContain('http-equiv="Content-Security-Policy"');
    expect(out).toContain('moabom-ai-preview-safety');
  });
});
