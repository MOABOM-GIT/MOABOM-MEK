import { describe, expect, it } from 'vitest';
import {
  buildGenerationDraftView,
  inferPhaseFromFinalize,
  normalizePartialHtml,
  resolveGenerationSource,
} from '../aiGenerationDraft';

const COMPLETE_HTML = '<!DOCTYPE html><html><head><title>x</title></head><body>ok</body></html>';
const PARTIAL_HTML = '<div class="hero"><h1>Hello';

describe('aiGenerationDraft', () => {
  it('스트리밍 중에는 streamedRaw를 우선한다', () => {
    expect(resolveGenerationSource('<html>old</html>', '<div>live', true)).toBe('<div>live');
  });

  it('스트리밍 종료 후 committedHtml이 있으면 committedHtml을 우선한다', () => {
    expect(resolveGenerationSource(COMPLETE_HTML, PARTIAL_HTML, false)).toBe(COMPLETE_HTML);
  });

  it('committedHtml이 비어 있으면 streamedRaw를 사용한다', () => {
    expect(resolveGenerationSource('', PARTIAL_HTML, false)).toBe(PARTIAL_HTML);
  });

  it('버퍼가 비면 committedHtml을 사용한다', () => {
    expect(resolveGenerationSource(COMPLETE_HTML, '', false)).toBe(COMPLETE_HTML);
  });

  it('완전한 HTML은 complete 초안으로 판정한다', () => {
    const view = buildGenerationDraftView(COMPLETE_HTML);

    expect(view.completeness).toBe('complete');
    expect(view.canSave).toBe(true);
    expect(view.canContinue).toBe(false);
    expect(view.previewHtml).toContain('<!DOCTYPE html>');
  });

  it('미완성 HTML은 partial 초안으로 정규화해 미리보기·저장을 허용한다', () => {
    const view = buildGenerationDraftView(PARTIAL_HTML);

    expect(view.completeness).toBe('partial');
    expect(view.canSave).toBe(true);
    expect(view.canContinue).toBe(true);
    expect(view.previewHtml).toContain('<!DOCTYPE html>');
    expect(view.previewHtml).toContain('Hello');
    expect(view.saveHtml).toContain('</body></html>');
  });

  it('normalizePartialHtml은 최소 문서 래퍼를 붙인다', () => {
    const normalized = normalizePartialHtml('<p>draft</p>');

    expect(normalized).toContain('<!DOCTYPE html>');
    expect(normalized).toContain('<p>draft</p>');
    expect(normalized).toContain('</html>');
  });

  it('truncated finalize는 truncated phase로 매핑한다', () => {
    expect(inferPhaseFromFinalize({ source: PARTIAL_HTML, truncated: true }, false, false)).toBe('truncated');
  });

  it('cancelled finalize는 paused phase로 매핑한다', () => {
    expect(
      inferPhaseFromFinalize({ source: PARTIAL_HTML, truncated: false, finishReason: 'cancelled' }, false, false),
    ).toBe('paused');
  });

  it('완성 finalize는 complete phase로 매핑한다', () => {
    expect(
      inferPhaseFromFinalize({ source: COMPLETE_HTML, truncated: false, finishReason: 'stop' }, false, false),
    ).toBe('complete');
  });
});
