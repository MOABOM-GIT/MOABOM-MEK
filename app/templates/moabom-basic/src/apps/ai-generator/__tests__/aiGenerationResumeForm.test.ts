import { describe, expect, it } from 'vitest';
import { readAiGenerationResumeFormFields } from '../aiGenerationResumeForm';
import type { AiGenerationSession } from '../../../api/moabomAppsApi';

function session(partial: Partial<AiGenerationSession>): AiGenerationSession {
  return {
    id: 1,
    status: 'paused',
    app_type: 'general',
    model_id: 'claude-sonnet',
    truncated: false,
    messages: [],
    ...partial,
  };
}

describe('readAiGenerationResumeFormFields', () => {
  it('세션의 title·prompt·tier·설정을 폼 필드로 읽는다', () => {
    const fields = readAiGenerationResumeFormFields(session({
      title: ' 내 계산기 ',
      prompt: ' 간단한 계산기 ',
      tier: 'hosted',
      app_type: 'game',
      model_id: 'gpt-4o',
    }));

    expect(fields).toEqual({
      title: '내 계산기',
      prompt: '간단한 계산기',
      appTier: 'hosted',
      appType: 'game',
      modelId: 'gpt-4o',
    });
  });

  it('누락된 값은 기본값으로 폴백한다', () => {
    const fields = readAiGenerationResumeFormFields(session({}));

    expect(fields.title).toBe('');
    expect(fields.prompt).toBe('');
    expect(fields.appTier).toBe('standard');
    expect(fields.appType).toBe('general');
    expect(fields.modelId).toBe('claude-sonnet');
  });
});
