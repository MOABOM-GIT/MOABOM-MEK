import { loadVisibleGeneratedAppSession } from './generatedAppVisibleSessionCache';

const GENERATED_APP_ID_PLACEHOLDER_PATTERN = /^(?:App #\d+|앱 #\d+)$/i;

/** 서버 id 기반 placeholder 제목(`App #24`, `앱 #24`) 여부 */
export function isGeneratedAppIdPlaceholderTitle(title: string | null | undefined): boolean {
  const trimmed = title?.trim();
  if (!trimmed) {
    return false;
  }
  return GENERATED_APP_ID_PLACEHOLDER_PATTERN.test(trimmed);
}

/** 후보 중 첫 번째 유효 표시 제목(placeholder·빈 문자열 제외) */
export function pickGeneratedAppDisplayTitle(
  ...candidates: Array<string | null | undefined>
): string {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed && !isGeneratedAppIdPlaceholderTitle(trimmed)) {
      return trimmed;
    }
  }
  return '';
}

export async function resolveGeneratedAppDisplayTitle(options: {
  serverId: number;
  authStateKey: string;
  catalogTitle?: string | null;
  preferredTitle?: string | null;
  untitledLabel: string;
}): Promise<string> {
  const fromPreferred = pickGeneratedAppDisplayTitle(
    options.preferredTitle,
    options.catalogTitle,
  );
  if (fromPreferred) {
    return fromPreferred;
  }

  try {
    const session = await loadVisibleGeneratedAppSession(options.serverId, options.authStateKey);
    const fromSession = pickGeneratedAppDisplayTitle(
      session.title?.trim(),
      session.prompt?.trim()?.slice(0, 80),
    );
    if (fromSession) {
      return fromSession;
    }
  } catch {
    // 세션 조회 실패 시 untitled 로 폴백
  }

  return options.untitledLabel;
}
