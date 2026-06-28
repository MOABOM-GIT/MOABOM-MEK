import { type RefObject } from 'react';
import { Div } from '../../components/basic/Div';
import { Icon } from '../../components/basic/Icon';
import { Textarea } from '../../components/basic/Textarea';
import { APP_SHELL_BODY_CLASS, APP_SHELL_TEXTAREA_RESIZABLE_CLASS } from '../appShellTypography';
import type { GenerationCompleteness } from './aiGenerationDraft';

type TranslateFn = (key: string) => string;

export interface AiGenerationCodePanelProps {
  isStreaming: boolean;
  codePreview: string;
  editableCode: string;
  completeness: GenerationCompleteness;
  onCodeChange: (nextCode: string) => void;
  onCodeCommit?: () => void;
  codePanelRef: RefObject<HTMLDivElement | null>;
  t: TranslateFn;
}

export function AiGenerationCodePanel({
  isStreaming,
  codePreview,
  editableCode,
  completeness,
  onCodeChange,
  onCodeCommit,
  codePanelRef,
  t,
}: AiGenerationCodePanelProps) {
  if (!isStreaming && !codePreview.trim()) {
    return null;
  }

  const panelTitle = isStreaming
    ? t('moa_apps_ai.stream_title_loading')
    : completeness === 'partial'
      ? t('moa_apps_ai.stream_title_partial')
      : t('moa_apps_ai.stream_title_editable');

  return (
    <Div className="flex min-h-0 shrink-0 flex-col">
      <Div className={`mb-2 flex items-center gap-2 ${APP_SHELL_BODY_CLASS}`}>
        <Icon
          name={isStreaming ? 'spinner' : 'code-branch'}
          className={isStreaming ? 'animate-spin text-faint' : 'text-faint'}
        />
        <span>{panelTitle}</span>
        {completeness === 'partial' && !isStreaming ? (
          <span className="moa-ai-draft-badge">{t('moa_apps_ai.recovery.badge_partial')}</span>
        ) : null}
      </Div>

      {isStreaming ? (
        <Div
          ref={codePanelRef}
          className="max-h-36 overflow-auto rounded-2xl bg-black/5 p-3 dark:bg-white/5 @xl:max-h-40"
        >
          <pre className="whitespace-pre-wrap break-words font-mono text-xs text-secondary">{codePreview}</pre>
        </Div>
      ) : (
        <Textarea
          className={`${APP_SHELL_TEXTAREA_RESIZABLE_CLASS} font-mono text-xs leading-relaxed`}
          value={editableCode}
          onChange={(event) => onCodeChange(event.target.value)}
          onBlur={() => onCodeCommit?.()}
          spellCheck={false}
          autoComplete="off"
          aria-label={t('moa_apps_ai.stream_title_editable')}
        />
      )}
    </Div>
  );
}
