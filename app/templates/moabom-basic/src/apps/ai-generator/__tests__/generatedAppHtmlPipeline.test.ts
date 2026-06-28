import { describe, expect, it } from 'vitest';
import {
  normalizeEditorHtmlInput,
  prepareGeneratedAppHtmlForPersist,
  toEditorHtmlFromStored,
} from '../generatedAppHtmlPipeline';

const COMPLETE_BODY = '<!DOCTYPE html><html><head><title>x</title></head><body><p>ok</p></body></html>';

describe('generatedAppHtmlPipeline', () => {
  it('BOM·CRLF·널 바이트를 정규화한다', () => {
    const input = `\uFEFF<!DOCTYPE html>\r\n<html><head></head><body>\0hi</body></html>`;
    const normalized = normalizeEditorHtmlInput(input);

    expect(normalized).not.toMatch(/^\uFEFF/);
    expect(normalized).not.toContain('\0');
    expect(normalized).toContain('\n');
    expect(normalized).not.toContain('\r');
  });

  it('미리보기·저장이 동일한 prepared html을 반환한다', () => {
    const prepared = prepareGeneratedAppHtmlForPersist(COMPLETE_BODY);

    expect(prepared.completeness).toBe('complete');
    expect(prepared.canSave).toBe(true);
    expect(prepared.html).toContain('moabom-ai-preview-safety');
    expect(prepared.html).toContain('<p>ok</p>');
  });

  it('저장된 HTML 로드 시 편집기·prepare 결과가 일치한다', () => {
    const stored = prepareGeneratedAppHtmlForPersist(COMPLETE_BODY).html;
    const editor = toEditorHtmlFromStored(stored);
    const reprepared = prepareGeneratedAppHtmlForPersist(editor);

    expect(editor).toBe(reprepared.html);
  });

  it('마크다운 펜스가 있어도 prepare 후 완전 문서로 저장 가능하다', () => {
    const fenced = `\`\`\`html\n${COMPLETE_BODY}\n\`\`\``;
    const prepared = prepareGeneratedAppHtmlForPersist(fenced);

    expect(prepared.completeness).toBe('complete');
    expect(prepared.html).toContain('<!DOCTYPE html>');
  });

  it('부분 HTML도 prepare 시 실행 가능한 최소 문서로 감싼다', () => {
    const prepared = prepareGeneratedAppHtmlForPersist('<h1>Hello</h1>');

    expect(prepared.completeness).toBe('partial');
    expect(prepared.canSave).toBe(true);
    expect(prepared.html).toContain('<h1>Hello</h1>');
    expect(prepared.html).toContain('</html>');
    expect(prepared.html).toContain('moabom-ai-preview-safety');
  });
});
