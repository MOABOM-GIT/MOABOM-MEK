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

/** 스트리밍 중·종료 후 항상 최신 원문을 고릅니다. */
export function resolveGenerationSource(
  committedHtml: string,
  streamedRaw: string,
  isStreaming: boolean,
): string {
  if (isStreaming && streamedRaw.trim()) {
    return streamedRaw;
  }
  if (streamedRaw.trim()) {
    return streamedRaw;
  }

  return committedHtml;
}

export function stripMarkdownHtmlFence(input: string): string {
  const codeBlock = input.match(/```html\s*([\s\S]*?)\s*```/);
  return (codeBlock ? codeBlock[1] : input).trim();
}

export function isCompleteHtmlDocument(input: string): boolean {
  return extractCompleteHtml(input) !== '';
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
${html}
</body>
</html>`;
  } else if (!hasBodyOpen) {
    if (/<\/head>/i.test(document)) {
      document = document.replace(/<\/head>/i, '</head><body>');
    } else if (/<head\b[^>]*>/i.test(document)) {
      document = document.replace(/<head\b[^>]*>/i, (match) => `${match}<body>`);
    } else {
      document = document.replace(/<html\b[^>]*>/i, (match) => `${match}<head><meta charset="utf-8"></head><body>`);
    }
    document = `${document}</body></html>`;
  }

  if (!/<\/body>/i.test(document)) {
    document = `${document}</body>`;
  }
  if (!/<\/html>/i.test(document)) {
    document = `${document}</html>`;
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
