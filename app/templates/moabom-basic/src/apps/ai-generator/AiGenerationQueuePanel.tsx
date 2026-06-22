import { useMemo } from 'react';
import { Button } from '../../components/basic/Button';
import { Div } from '../../components/basic/Div';
import { Icon } from '../../components/basic/Icon';
import { APP_SHELL_BODY_CLASS, APP_SHELL_DESC_CLASS } from '../appShellTypography';
import {
  formatQueueWaitLabel,
  formatQueueWaitUnit,
  type AiGenerationQueueState,
} from './aiGenerationQueue';

interface AiGenerationQueuePanelProps {
  queue: AiGenerationQueueState;
  t: (key: string, params?: Record<string, string | number>) => string;
  onCancel: () => void;
}

export function AiGenerationQueuePanel({ queue, t, onCancel }: AiGenerationQueuePanelProps) {
  const isStarting = queue.status === 'starting' || queue.status === 'ready';
  const waitLabel = useMemo(
    () => formatQueueWaitLabel(queue.estimatedWaitSeconds),
    [queue.estimatedWaitSeconds],
  );
  const waitUnit = useMemo(
    () => formatQueueWaitUnit(queue.estimatedWaitSeconds, t),
    [queue.estimatedWaitSeconds, t],
  );

  const headline = isStarting
    ? t('moa_apps_ai.queue.headline_starting')
    : t('moa_apps_ai.queue.headline_waiting');

  const description = isStarting
    ? t('moa_apps_ai.queue.description_starting')
    : t('moa_apps_ai.queue.description_waiting');

  return (
    <Div className="moa-ai-queue-panel" role="status" aria-live="polite">
      <Div className="moa-ai-queue-panel__glow" aria-hidden="true" />
      <Div className="moa-ai-queue-panel__content">
        <Div className="moa-ai-queue-panel__icon-wrap">
          <Icon
            name={isStarting ? 'sparkles' : 'hourglass-half'}
            className={isStarting ? 'moa-ai-queue-panel__icon moa-ai-queue-panel__icon--pulse' : 'moa-ai-queue-panel__icon'}
          />
        </Div>

        <Div className={`moa-ai-queue-panel__headline ${APP_SHELL_BODY_CLASS}`}>{headline}</Div>
        <Div className={`moa-ai-queue-panel__description ${APP_SHELL_DESC_CLASS}`}>{description}</Div>

        {!isStarting && queue.queuePosition > 0 ? (
          <Div className="moa-ai-queue-panel__position-card">
            <Div className="moa-ai-queue-panel__position-label">{t('moa_apps_ai.queue.position_label')}</Div>
            <Div className="moa-ai-queue-panel__position-value">{queue.queuePosition}</Div>
          </Div>
        ) : null}

        {!isStarting && waitLabel ? (
          <Div className="moa-ai-queue-panel__eta">
            <Icon name="clock" className="moa-ai-queue-panel__eta-icon" />
            <span>{t('moa_apps_ai.queue.estimated_wait', { value: waitLabel, unit: waitUnit })}</span>
          </Div>
        ) : null}

        <Div className="moa-ai-queue-panel__capacity">
          {t('moa_apps_ai.queue.capacity', {
            active: queue.activeCount,
            max: queue.maxActive,
          })}
        </Div>

        <Div className="moa-ai-queue-panel__progress" aria-hidden="true">
          <Div className={`moa-ai-queue-panel__progress-bar ${isStarting ? 'moa-ai-queue-panel__progress-bar--starting' : ''}`} />
        </Div>

        {!isStarting ? (
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
            {t('moa_apps_ai.queue.cancel')}
          </Button>
        ) : null}
      </Div>
    </Div>
  );
}
