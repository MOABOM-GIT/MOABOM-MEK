import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  fetchGeneratedApp,
  fetchVisibleGeneratedApp,
  storeGeneratedApp,
  updateGeneratedApp,
  type AiAppType,
  type StoredGeneratedApp,
} from '../../api/moabomAppsApi';
import { useMoabomShellT } from 'moabom-shell-i18n';
import {
  getCreateAppEditServerId,
  subscribeCreateAppEditServerId,
} from 'moabom-create-app-edit';
import { notifyGeneratedAppSaved } from '../generatedAppEvents';
import { Button } from '../../components/basic/Button';
import AppLoadingSpinner from '../../components/composite/AppLoadingSpinner';
import { Div } from '../../components/basic/Div';
import { Icon } from '../../components/basic/Icon';
import { Input } from '../../components/basic/Input';
import { Label } from '../../components/basic/Label';
import { Select } from '../../components/basic/Select';
import { Textarea } from '../../components/basic/Textarea';
import {
  APP_SHELL_BODY_CLASS,
  APP_SHELL_DESC_CLASS,
  APP_SHELL_INPUT_CLASS,
  APP_SHELL_PANEL_CLASS,
  APP_SHELL_SELECT_TRIGGER_CLASS,
  APP_SHELL_TEXTAREA_CLASS,
  APP_STACK_CLASS,
  APP_STACK_GRID_CLASS,
  APP_WINDOW_BODY_CLASS,
} from '../appShellTypography';
import { extractCompleteHtml, injectAiPreviewSafety } from './aiHtmlUtils';
import { useAiAppStream } from './useAiAppStream';

const appTypeOptions: Array<{ value: AiAppType; labelKey: string }> = [
  { value: 'general', labelKey: 'moa_apps_ai.types.general' },
  { value: '3d', labelKey: 'moa_apps_ai.types.3d' },
  { value: 'game', labelKey: 'moa_apps_ai.types.game' },
  { value: 'dataviz', labelKey: 'moa_apps_ai.types.dataviz' },
];

const modelOptions = [
  { value: 'claude-sonnet', labelKey: 'moa_apps_ai.models.claude_sonnet' },
  { value: 'gpt-chat-latest', labelKey: 'moa_apps_ai.models.gpt_chat_latest' },
  { value: 'gemini-flash-lite', labelKey: 'moa_apps_ai.models.gemini_flash_lite' },
];

const inputClassName = APP_SHELL_INPUT_CLASS;

export function AiGeneratorApp() {
  const { t } = useMoabomShellT();
  const editServerId = useSyncExternalStore(
    subscribeCreateAppEditServerId,
    getCreateAppEditServerId,
    () => null,
  );
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [appType, setAppType] = useState<AiAppType>('general');
  const [modelId, setModelId] = useState('claude-sonnet');
  const [html, setHtml] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [loadedEditId, setLoadedEditId] = useState<number | null>(null);
  const [remixSourceId, setRemixSourceId] = useState<number | null>(null);
  const [loadedSourceApp, setLoadedSourceApp] = useState<StoredGeneratedApp | null>(null);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const codePanelRef = useRef<HTMLDivElement>(null);

  const {
    streamedRaw,
    isStreaming,
    sessionId,
    truncated,
    resumeSession,
    resumeChecked,
    runStream,
    stopGeneration,
    adoptResumeSession,
    dismissResumeSession,
    setStreamedRaw,
  } = useAiAppStream({
    appType,
    modelId,
    generatedAppId: loadedEditId,
    onDone: (result) => {
      if (result.truncated) {
        setNotice(t('moa_apps_ai.notice_truncated'));
        return;
      }

      if (result.html) {
        setHtml(injectAiPreviewSafety(result.html));
      }
      setStreamedRaw('');
      setNotice(result.notice || (result.fallback ? t('moa_apps_ai.notice_fallback') : ''));
    },
  });

  useEffect(() => {
    if (!editServerId) {
      setLoadedEditId(null);
      setRemixSourceId(null);
      setLoadedSourceApp(null);
      return;
    }

    let cancelled = false;
    setIsLoadingEdit(true);
    setError('');
    setSavedMessage('');

    void (async () => {
      try {
        const app = await fetchVisibleGeneratedApp(editServerId);
        if (cancelled) {
          return;
        }
        const editingOwnApp = app.permissions?.is_owner !== false;
        setTitle(app.title?.trim() || '');
        setPrompt(app.prompt?.trim() || '');
        setAppType(app.app_type ?? 'general');
        setModelId(app.model_id ?? 'claude-sonnet');
        setHtml(injectAiPreviewSafety(app.html ?? ''));
        setLoadedEditId(editingOwnApp ? app.id : null);
        setRemixSourceId(editingOwnApp ? null : app.id);
        setLoadedSourceApp(app);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('moa_apps_ai.viewer_error'));
          setLoadedEditId(null);
          setRemixSourceId(null);
          setLoadedSourceApp(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingEdit(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editServerId, t]);

  useEffect(() => {
    if (!isStreaming || !codePanelRef.current) {
      return;
    }
    codePanelRef.current.scrollTop = codePanelRef.current.scrollHeight;
  }, [streamedRaw, isStreaming]);

  const liveSource = isStreaming && streamedRaw ? streamedRaw : html;
  const previewHtml = useMemo(() => {
    const complete = extractCompleteHtml(liveSource);
    if (complete) {
      return complete;
    }
    if (!isStreaming && liveSource) {
      return injectAiPreviewSafety(liveSource);
    }
    return '';
  }, [isStreaming, liveSource]);
  const codePreview = streamedRaw || html;
  const isEditingExisting = loadedEditId != null;
  const isRemixingExisting = remixSourceId != null;

  const handleGenerate = async (continueGeneration = false) => {
    setError('');
    setSavedMessage('');
    setNotice('');

    if (!continueGeneration && !prompt.trim()) {
      setError(t('moa_apps_ai.validation.prompt_required'));
      return;
    }

    try {
      const currentHtml = continueGeneration
        ? (streamedRaw || extractCompleteHtml(html) || html)
        : extractCompleteHtml(html);
      await runStream({
        prompt: continueGeneration ? prompt.trim() : prompt.trim(),
        currentHtml: currentHtml || null,
        continueGeneration,
        generationMode: continueGeneration ? 'append' : (currentHtml ? 'patch' : 'generate'),
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err.message : t('moa_apps_ai.error_generate'));
    }
  };

  const handleSave = async () => {
    setError('');
    setSavedMessage('');
    if (!title.trim()) {
      setError(t('moa_apps_ai.validation.title_required'));
      return;
    }
    const saveHtml = previewHtml || extractCompleteHtml(streamedRaw || html) || '';
    if (!saveHtml) {
      setError(t('moa_apps_ai.validation.html_required'));
      return;
    }

    const payload = {
      title: title.trim(),
      app_type: appType,
      model_id: modelId,
      prompt: prompt.trim(),
      html: saveHtml,
      metadata: {
        source: 'moabom-shell',
        ...(sessionId ? { ai_generation_session_id: sessionId } : {}),
        ...(isEditingExisting ? { updated: true } : {}),
        ...(isRemixingExisting ? { remix_source_id: remixSourceId } : {}),
      },
      ...(isRemixingExisting ? { parent_app_id: remixSourceId } : {}),
    };

    setIsSaving(true);
    try {
      if (loadedEditId != null) {
        const updated = await updateGeneratedApp(loadedEditId, payload);
        notifyGeneratedAppSaved(updated);
        setSavedMessage(t('moa_apps_ai.update_success'));
      } else {
        const saved = await storeGeneratedApp(payload);
        setLoadedEditId(saved.id);
        setRemixSourceId(null);
        notifyGeneratedAppSaved(saved);
        setSavedMessage(t('moa_apps_ai.save_success'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('moa_apps_ai.error_save'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingEdit) {
    return (
      <AppLoadingSpinner label={t('moa_apps_ai.viewer_loading')} fill />
    );
  }

  return (
    <Div className={`${APP_WINDOW_BODY_CLASS} ${APP_SHELL_BODY_CLASS}`}>
      {isEditingExisting || isRemixingExisting ? (
        <Div className="rounded-2xl bg-violet-500/10 px-3 py-2 text-sm font-bold text-violet-700 dark:text-violet-300">
          {isEditingExisting
            ? t('moa_apps_ai.editing_saved_app')
            : t('moa_apps_ai.remixing_saved_app', { name: loadedSourceApp?.owner?.nickname ?? '' })}
        </Div>
      ) : null}

      {resumeChecked && resumeSession?.partial_raw ? (
        <Div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          <Div>{t('moa_apps_ai.resume_banner')}</Div>
          <Div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                if (resumeSession) {
                  setAppType(resumeSession.app_type ?? 'general');
                  setModelId(resumeSession.model_id ?? 'claude-sonnet');
                  if (resumeSession.partial_raw) {
                    setHtml(injectAiPreviewSafety(resumeSession.partial_raw));
                  }
                }
                adoptResumeSession();
              }}
            >
              {t('moa_apps_ai.resume_load')}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={dismissResumeSession}>
              {t('moa_apps_ai.resume_dismiss')}
            </Button>
          </Div>
        </Div>
      ) : null}

      <Div className={`${APP_STACK_GRID_CLASS} grid min-h-[420px] flex-1 grid-cols-1 @xl:grid-cols-[380px_minmax(0,1fr)]`}>
        <Div className={`${APP_SHELL_PANEL_CLASS} ${APP_STACK_CLASS} h-full min-h-0`}>
          <Label className="block">
            <Div className={`mb-1 ${APP_SHELL_BODY_CLASS}`}>{t('moa_apps_ai.field_title')}</Div>
            <Input
              className={inputClassName}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t('moa_apps_ai.field_title_placeholder')}
            />
          </Label>

          <Div className="grid grid-cols-1 gap-3 @sm:grid-cols-2 @xl:grid-cols-1">
            <Label className="block">
              <Div className={`mb-1 ${APP_SHELL_BODY_CLASS}`}>{t('moa_apps_ai.field_type')}</Div>
              <Select
                className={APP_SHELL_SELECT_TRIGGER_CLASS}
                value={appType}
                options={appTypeOptions.map(option => ({ value: option.value, label: t(option.labelKey) }))}
                onChange={(event) => setAppType(event.target.value as AiAppType)}
              />
            </Label>
            <Label className="block">
              <Div className={`mb-1 ${APP_SHELL_BODY_CLASS}`}>{t('moa_apps_ai.field_model')}</Div>
              <Select
                className={APP_SHELL_SELECT_TRIGGER_CLASS}
                value={modelId}
                options={modelOptions.map(option => ({ value: option.value, label: t(option.labelKey) }))}
                onChange={(event) => setModelId(String(event.target.value))}
              />
            </Label>
          </Div>

          <Label className="flex min-h-[180px] flex-1 flex-col">
            <Div className={`mb-1 ${APP_SHELL_BODY_CLASS}`}>{t('moa_apps_ai.field_prompt')}</Div>
            <Textarea
              className={`${APP_SHELL_TEXTAREA_CLASS} min-h-[180px] flex-1`}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={previewHtml ? t('moa_apps_ai.field_modify_placeholder') : t('moa_apps_ai.field_prompt_placeholder')}
            />
          </Label>

          {notice ? (
            <Div className="rounded-2xl bg-blue-500/10 px-3 py-2 text-base font-bold text-blue-700 dark:text-blue-300">{notice}</Div>
          ) : null}
          {error ? (
            <Div className="rounded-2xl bg-red-500/10 px-3 py-2 text-base font-bold text-red-700 dark:text-red-300">{error}</Div>
          ) : null}
          {savedMessage ? (
            <Div className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-base font-bold text-emerald-700 dark:text-emerald-300">{savedMessage}</Div>
          ) : null}

          <Div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={previewHtml ? 'secondary' : 'primary'}
              onClick={() => void handleGenerate(false)}
              disabled={isStreaming}
            >
              {isStreaming ? t('moa_apps_ai.generating') : previewHtml ? t('moa_apps_ai.modify') : t('moa_apps_ai.generate')}
            </Button>
            {isStreaming ? (
              <Button type="button" variant="secondary" onClick={() => void stopGeneration()}>
                {t('moa_apps_ai.stop_generate')}
              </Button>
            ) : null}
            {truncated ? (
              <Button type="button" variant="secondary" onClick={() => void handleGenerate(true)} disabled={isStreaming}>
                {t('moa_apps_ai.continue_generate')}
              </Button>
            ) : null}
            <Button type="button" variant="primary" onClick={handleSave} disabled={isSaving || (!previewHtml && !streamedRaw && !html) || isStreaming}>
              {isSaving
                ? t('moa_apps_ai.saving')
                : isEditingExisting
                  ? t('moa_apps_ai.update')
                  : isRemixingExisting
                    ? t('moa_apps_ai.save_remix')
                  : t('moa_apps_ai.save')}
            </Button>
          </Div>
        </Div>

        <Div className={`${APP_SHELL_PANEL_CLASS} ${APP_STACK_CLASS} min-h-0 overflow-hidden`}>
          {(isStreaming || codePreview) ? (
            <Div className="min-h-0 shrink-0">
              <Div className={`mb-2 flex items-center gap-2 ${APP_SHELL_BODY_CLASS}`}>
                <Icon name={isStreaming ? 'spinner' : 'code-branch'} className={isStreaming ? 'animate-spin text-faint' : 'text-faint'} />
                {isStreaming ? t('moa_apps_ai.stream_title_loading') : t('moa_apps_ai.stream_title')}
              </Div>
              <Div
                ref={codePanelRef}
                className="max-h-36 overflow-auto rounded-2xl bg-black/5 p-3 dark:bg-white/5 @xl:max-h-40"
              >
                <pre className="whitespace-pre-wrap break-words font-mono text-xs text-secondary">{codePreview}</pre>
              </Div>
            </Div>
          ) : null}

          {previewHtml ? (
            <iframe
              title={t('moa_apps_ai.preview_title')}
              className="min-h-[280px] w-full flex-1 rounded-2xl border border-white/60 bg-white"
              srcDoc={previewHtml}
              sandbox="allow-scripts"
            />
          ) : (
            <Div className="flex h-full min-h-[280px] flex-1 flex-col items-center justify-center gap-3 text-center">
              <Icon name="file-alt" className="text-4xl text-faint" />
              <Div className={APP_SHELL_BODY_CLASS}>{t('moa_apps_ai.preview_empty_title')}</Div>
              <Div className={`max-w-md ${APP_SHELL_DESC_CLASS}`}>{t('moa_apps_ai.preview_empty_description')}</Div>
            </Div>
          )}
        </Div>
      </Div>
    </Div>
  );
}
