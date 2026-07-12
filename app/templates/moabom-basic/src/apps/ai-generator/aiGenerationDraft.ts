import { extractCompleteHtml, injectAiPreviewSafety } from './aiHtmlUtils';

export type GenerationPhase =
  | 'idle'
  | 'streaming'
  | 'queued'
  | 'complete'
  | 'truncated'
  | 'paused'
  | 'failed';

export type GenerationCompleteness = 'empty' | 'partial' | 'complete';

export interface GenerationDraftFinalize {
  source: string;
  truncated: boolean;
  finishReason?: string | null;
  notice?: string | null;
  fallback?: boolean;
}

export interface GenerationDraftView {
  source: string;
  completeness: GenerationCompleteness;
  previewHtml: string;
  saveHtml: string;
  canSave: boolean;
  canContinue: boolean;
}

/**
 * 미리보기·저장용 HTML 원문을 고릅니다.
 * 스트리밍 중에는 live 버퍼를, 종료 후에는 committedHtml(수동 편집·finalize 반영)을 우선합니다.
 */
export function resolveGenerationSource(
  committedHtml: string,
  streamedRaw: string,
  isStreaming: boolean,
): string {
  if (isStreaming && streamedRaw.trim()) {
    return streamedRaw;
  }
  if (committedHtml.trim()) {
    return committedHtml;
  }
  if (streamedRaw.trim()) {
    return streamedRaw;
  }

  return '';
}

export function stripMarkdownHtmlFence(input: string): string {
  const codeBlock = input.match(/```html\s*([\s\S]*?)\s*```/);
  return (codeBlock ? codeBlock[1] : input).trim();
}

export function isCompleteHtmlDocument(input: string): boolean {
  return extractCompleteHtml(input) !== '';
}

/** script/style 태그가 닫히지 않았으면 true — 조기 </body></html> 삽입 방지 */
export function hasUnclosedScriptOrStyle(html: string): boolean {
  const openScript = (html.match(/<script\b[^>]*>/gi) || []).length;
  const closeScript = (html.match(/<\/script>/gi) || []).length;
  const openStyle = (html.match(/<style\b[^>]*>/gi) || []).length;
  const closeStyle = (html.match(/<\/style>/gi) || []).length;
  return openScript > closeScript || openStyle > closeStyle;
}

/** 미완성 HTML을 미리보기·저장 가능한 최소 문서로 정규화합니다. */
export function normalizePartialHtml(input: string): string {
  const html = stripMarkdownHtmlFence(input);
  if (!html) {
    return '';
  }

  if (isCompleteHtmlDocument(html)) {
    return extractCompleteHtml(html);
  }

  const hasHtmlRoot = /<!DOCTYPE html>/i.test(html) || /<html\b/i.test(html);
  const hasBodyOpen = /<body\b/i.test(html);
  const leaveOpen = hasUnclosedScriptOrStyle(html);
  let document = html;

  if (!hasHtmlRoot) {
    document = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Moabom Draft</title>
</head>
<body>
${html}${leaveOpen ? '' : '\n</body>\n</html>'}`;
  } else if (!hasBodyOpen) {
    if (/<\/head>/i.test(document)) {
      document = document.replace(/<\/head>/i, '</head><body>');
    } else if (/<head\b[^>]*>/i.test(document)) {
      document = document.replace(/<head\b[^>]*>/i, (match) => `${match}<body>`);
    } else {
      document = document.replace(/<html\b[^>]*>/i, (match) => `${match}<head><meta charset="utf-8"></head><body>`);
    }
    if (!leaveOpen) {
      document = `${document}</body></html>`;
    }
  }

  if (!leaveOpen) {
    if (!/<\/body>/i.test(document)) {
      document = `${document}</body>`;
    }
    if (!/<\/html>/i.test(document)) {
      document = `${document}</html>`;
    }
  }

  return injectAiPreviewSafety(document);
}

export function buildGenerationDraftView(source: string): GenerationDraftView {
  const trimmed = source.trim();
  if (!trimmed) {
    return {
      source: '',
      completeness: 'empty',
      previewHtml: '',
      saveHtml: '',
      canSave: false,
      canContinue: false,
    };
  }

  const complete = extractCompleteHtml(trimmed);
  if (complete) {
    return {
      source: trimmed,
      completeness: 'complete',
      previewHtml: complete,
      saveHtml: complete,
      canSave: true,
      canContinue: false,
    };
  }

  const normalized = normalizePartialHtml(trimmed);

  return {
    source: trimmed,
    completeness: 'partial',
    previewHtml: normalized,
    saveHtml: normalized,
    canSave: normalized !== '',
    canContinue: true,
  };
}

export function inferPhaseFromFinalize(
  finalize: GenerationDraftFinalize,
  isStreaming: boolean,
  isQueued: boolean,
): GenerationPhase {
  if (isStreaming) {
    return isQueued ? 'queued' : 'streaming';
  }
  if (!finalize.source.trim()) {
    return finalize.finishReason === 'error' || finalize.finishReason === 'no_key' ? 'failed' : 'idle';
  }
  if (finalize.truncated || finalize.finishReason === 'length' || finalize.finishReason === 'max_tokens') {
    return 'truncated';
  }
  if (finalize.finishReason === 'cancelled' || finalize.finishReason === 'error') {
    return 'paused';
  }
  if (buildGenerationDraftView(finalize.source).completeness === 'complete') {
    return 'complete';
  }

  return 'paused';
}
