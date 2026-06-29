import type { AiAppType, AiGenerationSession, AppTier } from '../../api/moabomAppsApi';

export interface AiGenerationResumeFormFields {
  title: string;
  prompt: string;
  appType: AiAppType;
  appTier: AppTier;
  modelId: string;
}

/** 서버 세션에서 이어하기용 폼 필드를 읽습니다. */
export function readAiGenerationResumeFormFields(session: AiGenerationSession): AiGenerationResumeFormFields {
  return {
    title: session.title?.trim() ?? '',
    prompt: session.prompt?.trim() ?? '',
    appType: session.app_type ?? 'general',
    appTier: session.tier ?? 'standard',
    modelId: session.model_id ?? 'claude-sonnet',
  };
}
