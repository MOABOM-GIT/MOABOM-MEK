import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  fetchVisibleGeneratedApp,
  storeGeneratedApp,
  updateGeneratedApp,
  type AiAppType,
  type AppTier,
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
  APP_SHELL_PANEL_STACK_CLASS,
  APP_SHELL_SELECT_TRIGGER_CLASS,
  APP_SHELL_TEXTAREA_CLASS,
  APP_STACK_GRID_CLASS,
  APP_WINDOW_BODY_CLASS,
} from '../appShellTypography';
import { injectAiPreviewSafety } from './aiHtmlUtils';
import { buildGenerationDraftView, resolveGenerationSource } from './aiGenerationDraft';
import { AiGenerationQueuePanel } from './AiGenerationQueuePanel';
import { AiGenerationRecoveryBanner } from './AiGenerationRecoveryBanner';
import { useAiAppStream } from './useAiAppStream';

const appTierOptions: Array<{ value: AppTier; labelKey: string }> = [
  { value: 'standard', labelKey: 'moa_apps_ai.tiers.standard' },
  { value: 'hosted', labelKey: 'moa_apps_ai.tiers.hosted' },
];

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
  const [appTier, setAppTier] = useState<AppTier>('standard');
  const [modelId, setModelId] = useState('claude-sonnet');
  const [draftHtml, setDraftHtml] = useState('');
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
    generationPhase,
    resumeSession,
    resumeChecked,
    queueState,
    isQueued,
    runStream,
    stopGeneration,
    cancelQueue,
    adoptResumeSession,
    dismissResumeSession,
    clearStreamedBuffer,
  } = useAiAppStream({
    appType,
    appTier,
    modelId,
    generatedAppId: loadedEditId,
    onDraftFinalize: (draft) => {
      if (draft.source.trim()) {
        const view = buildGenerationDraftView(draft.source);
        setDraftHtml(view.saveHtml);
        clearStreamedBuffer();
      }

      if (draft.truncated) {
        setNotice(t('moa_apps_ai.notice_truncated'));
        return;
      }

      if (draft.finishReason === 'cancelled') {
        setNotice(t('moa_apps_ai.recovery.notice_paused'));
        return;
      }

      if (draft.fallback) {
        setNotice(t('moa_apps_ai.notice_fallback'));
        return;
      }

      if (draft.notice) {
        setNotice(draft.notice);
        return;
      }

      if (buildGenerationDraftView(draft.source).completeness === 'complete') {
        setNotice('');
      }
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
        setAppTier(app.tier ?? 'standard');
        setModelId(app.model_id ?? 'claude-sonnet');
        setDraftHtml(injectAiPreviewSafety(app.html ?? ''));
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

  const draftSource = resolveGenerationSource(draftHtml, streamedRaw, isStreaming);
  const draftView = useMemo(() => buildGenerationDraftView(draftSource), [draftSource]);
  const previewHtml = draftView.previewHtml;
  const codePreview = draftSource;
  const isEditingExisting = loadedEditId != null;
  const isRemixingExisting = remixSourceId != null;
  const needsRecovery = !isStreaming && draftView.canContinue;

  const handleGenerate = async (continueGeneration = false) => {
    setError('');
    setSavedMessage('');
    if (!continueGeneration) {
      setNotice('');
    }

    if (!continueGeneration && !prompt.trim()) {
      setError(t('moa_apps_ai.validation.prompt_required'));
      return;
    }

    try {
      const currentHtml = continueGeneration
        ? draftView.saveHtml || draftSource
        : draftView.saveHtml || '';

      await runStream({
        prompt: prompt.trim(),
        currentHtml: currentHtml || null,
        continueGeneration,
        generationMode: continueGeneration ? 'append' : (currentHtml ? 'patch' : 'generate'),
        existingSessionId: sessionId,
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

    const saveHtml = draftView.saveHtml;
    if (!saveHtml) {
      setError(t('moa_apps_ai.validation.html_required'));
      return;
    }

    const isDraftSave = draftView.completeness === 'partial';
    const payload = {
      title: title.trim(),
      app_type: appType,
      tier: appTier,
      model_id: modelId,
      prompt: prompt.trim(),
      html: saveHtml,
      metadata: {
        source: 'moabom-shell',
        generation_status: draftView.completeness,
        generation_complete: draftView.completeness === 'complete',
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
        setSavedMessage(isDraftSave ? t('moa_apps_ai.recovery.save_draft_success') : t('moa_apps_ai.update_success'));
      } else {
        const saved = await storeGeneratedApp(payload);
        setLoadedEditId(saved.id);
        setRemixSourceId(null);
        notifyGeneratedAppSaved(saved);
        setSavedMessage(isDraftSave ? t('moa_apps_ai.recovery.save_draft_success') : t('moa_apps_ai.save_success'));
      }
      setDraftHtml(saveHtml);
      clearStreamedBuffer();
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

      {appTier === 'hosted' && !isEditingExisting ? (
        <Div className={`rounded-2xl bg-indigo-500/10 px-3 py-2 text-sm text-indigo-800 dark:text-indigo-200 ${APP_SHELL_DESC_CLASS}`}>
          {t('moa_apps_ai.tier_hosted_provision_hint')}
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

      <AiGenerationRecoveryBanner
        phase={generationPhase}
        completeness={draftView.completeness}
        appTier={appTier}
        t={t}
        onContinue={() => void handleGenerate(true)}
        onSaveDraft={() => void handleSave()}
        isSaving={isSaving}
        isStreaming={isStreaming}
      />

      <Div className={`${APP_STACK_GRID_CLASS} grid min-h-[420px] flex-1 grid-cols-1 @xl:grid-cols-[380px_minmax(0,1fr)]`}>
        <Div className={`${APP_SHELL_PANEL_STACK_CLASS} h-full min-h-0`}>
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
              <Div className={`mb-1 ${APP_SHELL_BODY_CLASS}`}>{t('moa_apps_ai.field_tier')}</Div>
              <Select
                className={APP_SHELL_SELECT_TRIGGER_CLASS}
                value={appTier}
                options={appTierOptions.map(option => ({ value: option.value, label: t(option.labelKey) }))}
                onChange={(event) => setAppTier(event.target.value as AppTier)}
                disabled={isEditingExisting}
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
              {isQueued ? t('moa_apps_ai.queue.waiting_button') : isStreaming ? t('moa_apps_ai.generating') : previewHtml ? t('moa_apps_ai.modify') : t('moa_apps_ai.generate')}
            </Button>
            {isStreaming ? (
              <Button type="button" variant="secondary" onClick={() => void stopGeneration()}>
                {isQueued ? t('moa_apps_ai.queue.cancel') : t('moa_apps_ai.stop_generate')}
              </Button>
            ) : null}
            {needsRecovery ? (
              <Button type="button" variant="secondary" onClick={() => void handleGenerate(true)} disabled={isStreaming}>
                {t('moa_apps_ai.continue_generate')}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleSave()}
              disabled={isSaving || !draftView.canSave || isStreaming}
            >
              {isSaving
                ? t('moa_apps_ai.saving')
                : draftView.completeness === 'partial'
                  ? t('moa_apps_ai.recovery.save_draft')
                  : isEditingExisting
                    ? t('moa_apps_ai.update')
                    : isRemixingExisting
                      ? t('moa_apps_ai.save_remix')
                      : t('moa_apps_ai.save')}
            </Button>
          </Div>
        </Div>

        <Div className={`${APP_SHELL_PANEL_STACK_CLASS} min-h-0 overflow-hidden relative`}>
          {queueState ? (
            <AiGenerationQueuePanel
              queue={queueState}
              t={t}
              onCancel={() => void cancelQueue()}
            />
          ) : null}

          {(isStreaming || codePreview) ? (
            <Div className="min-h-0 shrink-0">
              <Div className={`mb-2 flex items-center gap-2 ${APP_SHELL_BODY_CLASS}`}>
                <Icon name={isStreaming ? 'spinner' : 'code-branch'} className={isStreaming ? 'animate-spin text-faint' : 'text-faint'} />
                <span>
                  {isStreaming
                    ? t('moa_apps_ai.stream_title_loading')
                    : draftView.completeness === 'partial'
                      ? t('moa_apps_ai.stream_title_partial')
                      : t('moa_apps_ai.stream_title')}
                </span>
                {draftView.completeness === 'partial' && !isStreaming ? (
                  <span className="moa-ai-draft-badge">{t('moa_apps_ai.recovery.badge_partial')}</span>
                ) : null}
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
