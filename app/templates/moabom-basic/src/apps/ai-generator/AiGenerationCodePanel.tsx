import { type RefObject } from 'react';
import { Div } from '../../components/basic/Div';
import { Icon } from '../../components/basic/Icon';
import { Textarea } from '../../components/basic/Textarea';
import { Moa_CopyToClipboardButton } from '../../components/basic/Moa_CopyToClipboardButton';
import { APP_SHELL_BODY_CLASS, APP_SHELL_TEXTAREA_CLASS } from '../appShellTypography';
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
    <Div className="moa-ai-code-panel flex min-h-0 flex-1 flex-col">
      <Div className={`moa-ai-code-panel__toolbar mb-2 ${APP_SHELL_BODY_CLASS}`}>
        <Div className="flex min-w-0 items-center gap-2">
          <Icon
            name={isStreaming ? 'spinner' : 'code-branch'}
            className={isStreaming ? 'animate-spin text-faint' : 'text-faint'}
          />
          <span className="truncate">{panelTitle}</span>
          {completeness === 'partial' && !isStreaming ? (
            <span className="moa-ai-draft-badge">{t('moa_apps_ai.recovery.badge_partial')}</span>
          ) : null}
        </Div>
        {!isStreaming && editableCode.trim() ? (
          <Moa_CopyToClipboardButton
            text={editableCode}
            label={t('moa_apps_ai.copy_code')}
            copiedLabel={t('moa_apps_ai.copy_code_done')}
            size="sm"
          />
        ) : null}
      </Div>

      {isStreaming ? (
        <Div
          ref={codePanelRef}
          className="moa-ai-code-panel__stream min-h-0 flex-1 overflow-auto rounded-2xl bg-black/5 p-3 dark:bg-white/5"
        >
          <pre className="whitespace-pre-wrap break-words font-mono text-xs text-secondary">{codePreview}</pre>
        </Div>
      ) : (
        <Textarea
          className={`${APP_SHELL_TEXTAREA_CLASS} moa-ai-code-panel__textarea font-mono text-xs leading-relaxed`}
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
