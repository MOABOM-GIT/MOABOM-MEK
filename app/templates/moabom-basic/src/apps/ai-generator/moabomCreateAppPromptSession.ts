/**
 * create-app 셸로 넘기는 초기 제목·프롬프트 핸드오프.
 * 메인 `src/index.ts` → `window.__MoabomCreateAppPrompt` 싱글톤.
 * create-app IIFE 는 이 모듈을 external 로 공유해야 한다 (edit 세션과 동일).
 */
export type CreateAppHandoffPayload = {
  title: string | null;
  prompt: string;
};

let handoff: CreateAppHandoffPayload | null = null;
const listeners = new Set<() => void>();

function normalizeTitle(title: string | null | undefined): string | null {
  const trimmed = typeof title === 'string' ? title.trim() : '';
  return trimmed !== '' ? trimmed.slice(0, 80) : null;
}

function normalizePrompt(prompt: string | null | undefined): string | null {
  const trimmed = typeof prompt === 'string' ? prompt.trim() : '';
  return trimmed !== '' ? trimmed : null;
}

function notify(): void {
  listeners.forEach(listener => listener());
}

/**
 * @param promptOrPayload 프롬프트 문자열 또는 { title, prompt }
 * @param title 문자열 오버로드일 때 선택 제목
 */
export function setCreateAppHandoffPrompt(
  promptOrPayload: string | CreateAppHandoffPayload | null | undefined,
  title?: string | null,
): void {
  let next: CreateAppHandoffPayload | null = null;

  if (promptOrPayload && typeof promptOrPayload === 'object') {
    const prompt = normalizePrompt(promptOrPayload.prompt);
    if (prompt) {
      next = {
        title: normalizeTitle(promptOrPayload.title),
        prompt,
      };
    }
  } else {
    const prompt = normalizePrompt(promptOrPayload);
    if (prompt) {
      next = {
        title: normalizeTitle(title),
        prompt,
      };
    }
  }

  const same = handoff?.prompt === next?.prompt
    && handoff?.title === next?.title
    && (handoff == null) === (next == null);
  if (same) {
    return;
  }

  handoff = next;
  notify();
}

export function consumeCreateAppHandoffPrompt(): CreateAppHandoffPayload | null {
  const value = handoff;
  handoff = null;
  notify();
  return value;
}

export function getCreateAppHandoffPrompt(): CreateAppHandoffPayload | null {
  return handoff;
}

export function subscribeCreateAppHandoffPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
