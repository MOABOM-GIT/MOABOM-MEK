import { type RefObject } from 'react';
import { Button } from '../../components/basic/Button';
import { Div } from '../../components/basic/Div';
import { Icon } from '../../components/basic/Icon';
import { Moa_CopyToClipboardButton } from '../../components/basic/Moa_CopyToClipboardButton';
import { APP_SHELL_BODY_CLASS } from '../appShellTypography';
import type { GenerationCompleteness } from './aiGenerationDraft';
import { AiHtmlCodeMirrorEditor } from './AiHtmlCodeMirrorEditor';

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
  /** 직접 입력 모드 — 빈 에디터도 표시, 제목 paste 전용 */
  pasteMode?: boolean;
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
  pasteMode = false,
}: AiGenerationCodePanelProps) {
  if (!pasteMode && !isStreaming && !codePreview.trim()) {
    return null;
  }

  const panelTitle = isStreaming
    ? t('moa_apps_ai.stream_title_loading')
    : pasteMode
      ? t('moa_apps_ai.stream_title_paste')
      : completeness === 'partial'
        ? t('moa_apps_ai.stream_title_partial')
        : t('moa_apps_ai.stream_title_editable');

  const editorLabel = pasteMode
    ? t('moa_apps_ai.stream_title_paste')
    : t('moa_apps_ai.stream_title_editable');

  const handleClearCode = () => {
    if (isStreaming || !editableCode.trim()) {
      return;
    }
    onCodeChange('');
    onCodeCommit?.();
  };

  return (
    <Div className="moa-ai-code-panel flex min-h-0 flex-1 flex-col">
      <Div className={`moa-ai-code-panel__toolbar mb-2 ${APP_SHELL_BODY_CLASS}`}>
        <Div className="flex min-w-0 items-center gap-2">
          <Icon
            name={isStreaming ? 'spinner' : 'code-branch'}
            className={isStreaming ? 'animate-spin text-faint' : 'text-faint'}
          />
          <span className="truncate">{panelTitle}</span>
          {completeness === 'partial' && !isStreaming && !pasteMode ? (
            <span className="moa-ai-draft-badge">{t('moa_apps_ai.recovery.badge_partial')}</span>
          ) : null}
        </Div>
        {!isStreaming && editableCode.trim() ? (
          <Div className="moa-ai-code-panel__actions flex shrink-0 items-center gap-1.5">
            <Moa_CopyToClipboardButton
              text={editableCode}
              label={t('moa_apps_ai.copy_code')}
              copiedLabel={t('moa_apps_ai.copy_code_done')}
              size="sm"
            />
            <Button
              type="button"
              variant="dark-outline"
              size="sm"
              className="moa-ai-code-panel__clear"
              onClick={handleClearCode}
              aria-label={t('moa_apps_ai.clear_code')}
              title={t('moa_apps_ai.clear_code')}
            >
              <Icon name="trash" className="text-xs" aria-hidden />
              <span className="ml-1">{t('moa_apps_ai.clear_code')}</span>
            </Button>
          </Div>
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
        <AiHtmlCodeMirrorEditor
          value={editableCode}
          onChange={onCodeChange}
          onBlurCommit={onCodeCommit}
          ariaLabel={editorLabel}
        />
      )}
    </Div>
  );
}
