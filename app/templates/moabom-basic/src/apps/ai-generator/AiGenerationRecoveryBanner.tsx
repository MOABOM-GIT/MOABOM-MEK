import { Button } from '../../components/basic/Button';
import { Div } from '../../components/basic/Div';
import { Icon } from '../../components/basic/Icon';
import { APP_SHELL_BODY_CLASS, APP_SHELL_DESC_CLASS } from '../appShellTypography';
import type { AppTier } from '../../api/moabomAppsApi';
import type { GenerationCompleteness, GenerationPhase } from './aiGenerationDraft';

interface AiGenerationRecoveryBannerProps {
  phase: GenerationPhase;
  completeness: GenerationCompleteness;
  appTier: AppTier;
  t: (key: string, params?: Record<string, string | number>) => string;
  onContinue: () => void;
  onSaveDraft: () => void;
  isSaving: boolean;
  isStreaming: boolean;
}

export function AiGenerationRecoveryBanner({
  phase,
  completeness,
  appTier,
  t,
  onContinue,
  onSaveDraft,
  isSaving,
  isStreaming,
}: AiGenerationRecoveryBannerProps) {
  if (isStreaming || completeness === 'empty') {
    return null;
  }

  const showRecovery = phase === 'truncated' || phase === 'paused' || completeness === 'partial';
  if (!showRecovery) {
    return null;
  }

  const headline = phase === 'truncated'
    ? t('moa_apps_ai.recovery.headline_truncated')
    : t('moa_apps_ai.recovery.headline_paused');

  const description = phase === 'truncated'
    ? t('moa_apps_ai.recovery.description_truncated')
    : t('moa_apps_ai.recovery.description_paused');

  return (
    <Div className="moa-ai-recovery-banner" role="status" aria-live="polite">
      <Div className="moa-ai-recovery-banner__icon-wrap">
        <Icon name="exclamation-triangle" className="moa-ai-recovery-banner__icon" />
      </Div>
      <Div className="moa-ai-recovery-banner__copy">
        <Div className={`moa-ai-recovery-banner__headline ${APP_SHELL_BODY_CLASS}`}>{headline}</Div>
        <Div className={`moa-ai-recovery-banner__description ${APP_SHELL_DESC_CLASS}`}>{description}</Div>
        {appTier === 'hosted' ? (
          <Div className={`moa-ai-recovery-banner__hint ${APP_SHELL_DESC_CLASS}`}>
            {t('moa_apps_ai.recovery.hosted_hint')}
          </Div>
        ) : null}
      </Div>
      <Div className="moa-ai-recovery-banner__actions">
        <Button type="button" variant="primary" size="sm" onClick={onContinue} disabled={isStreaming}>
          {t('moa_apps_ai.continue_generate')}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onSaveDraft} disabled={isSaving || isStreaming}>
          {isSaving ? t('moa_apps_ai.saving') : t('moa_apps_ai.recovery.save_draft')}
        </Button>
      </Div>
    </Div>
  );
}
