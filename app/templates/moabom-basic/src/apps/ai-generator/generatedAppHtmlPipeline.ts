import {
  buildGenerationDraftView,
  type GenerationCompleteness,
  stripMarkdownHtmlFence,
} from './aiGenerationDraft';

export interface PreparedGeneratedAppHtml {
  completeness: GenerationCompleteness;
  /** 미리보기·DB 저장·편집기 동기화에 쓰는 단일 HTML (prepare 결과). */
  html: string;
  canSave: boolean;
  canContinue: boolean;
}

/**
 * 편집기 입력 정규화 — 인코딩·줄바꿈·마크다운 펜스 제거.
 * 저장/미리보기 직전에 항상 거칩니다.
 */
export function normalizeEditorHtmlInput(input: string): string {
  if (!input) {
    return '';
  }

  const withoutBom = input.replace(/^\uFEFF/, '');
  const normalizedLines = withoutBom.replace(/\r\n?/g, '\n').replace(/\0/g, '');

  return stripMarkdownHtmlFence(normalizedLines).trim();
}

/**
 * 미리보기 iframe · DB 저장 · 편집기 커밋이 공유하는 단일 준비 파이프라인.
 */
export function prepareGeneratedAppHtmlForPersist(input: string): PreparedGeneratedAppHtml {
  const normalized = normalizeEditorHtmlInput(input);
  const view = buildGenerationDraftView(normalized);

  return {
    completeness: view.completeness,
    html: view.saveHtml,
    canSave: view.canSave,
    canContinue: view.canContinue,
  };
}

/**
 * DB·API에서 불러온 HTML을 편집기·미리보기용으로 정규화합니다.
 * 런타임 전용 스크립트 제거 후 safety 를 멱등 주입합니다.
 */
export function toEditorHtmlFromStored(storedHtml: string): string {
  if (!storedHtml.trim()) {
    return '';
  }

  return prepareGeneratedAppHtmlForPersist(storedHtml).html;
}
