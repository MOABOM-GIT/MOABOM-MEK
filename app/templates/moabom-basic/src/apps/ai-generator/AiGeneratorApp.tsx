import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  fetchGeneratedApp,
  generateAiApp,
  storeGeneratedApp,
  updateGeneratedApp,
  type AiAppType,
} from '../../api/moabomAppsApi';
import { useMoabomShellT } from 'moabom-shell-i18n';
import {
  getCreateAppEditServerId,
  subscribeCreateAppEditServerId,
} from 'moabom-create-app-edit';
import { Button } from '../../components/basic/Button';
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
} from '../appShellTypography';
import { extractCompleteHtml, injectAiPreviewSafety } from './aiHtmlUtils';

const appTypeOptions: Array<{ value: AiAppType; labelKey: string }> = [
  { value: 'general', labelKey: 'moa_apps_ai.types.general' },
  { value: '3d', labelKey: 'moa_apps_ai.types.3d' },
  { value: 'game', labelKey: 'moa_apps_ai.types.game' },
  { value: 'dataviz', labelKey: 'moa_apps_ai.types.dataviz' },
];

const modelOptions = [
  { value: 'claude-sonnet', labelKey: 'moa_apps_ai.models.claude_sonnet' },
  { value: 'gpt-4o', labelKey: 'moa_apps_ai.models.gpt4o' },
  { value: 'gemini-flash', labelKey: 'moa_apps_ai.models.gemini_flash' },
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [loadedEditId, setLoadedEditId] = useState<number | null>(null);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);

  useEffect(() => {
    if (!editServerId) {
      setLoadedEditId(null);
      return;
    }

    let cancelled = false;
    setIsLoadingEdit(true);
    setError('');
    setSavedMessage('');

    void (async () => {
      try {
        const app = await fetchGeneratedApp(editServerId);
        if (cancelled) {
          return;
        }
        setTitle(app.title?.trim() || '');
        setPrompt(app.prompt?.trim() || '');
        setAppType(app.app_type ?? 'general');
        setModelId(app.model_id ?? 'claude-sonnet');
        setHtml(injectAiPreviewSafety(app.html ?? ''));
        setLoadedEditId(app.id);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('moa_apps_ai.viewer_error'));
          setLoadedEditId(null);
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

  const previewHtml = useMemo(() => extractCompleteHtml(html) || injectAiPreviewSafety(html), [html]);
  const isEditingExisting = loadedEditId != null;

  const handleGenerate = async () => {
    setError('');
    setSavedMessage('');
    setNotice('');
    if (!prompt.trim()) {
      setError(t('moa_apps_ai.validation.prompt_required'));
      return;
    }

    setIsGenerating(true);
    try {
      const currentHtml = extractCompleteHtml(html);
      const result = await generateAiApp({
        prompt: prompt.trim(),
        app_type: appType,
        model_id: modelId,
        current_html: currentHtml || null,
      });
      setHtml(injectAiPreviewSafety(result.html));
      setNotice(result.notice || (result.fallback ? t('moa_apps_ai.notice_fallback') : ''));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('moa_apps_ai.error_generate'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    setError('');
    setSavedMessage('');
    if (!title.trim()) {
      setError(t('moa_apps_ai.validation.title_required'));
      return;
    }
    if (!previewHtml) {
      setError(t('moa_apps_ai.validation.html_required'));
      return;
    }

    const payload = {
      title: title.trim(),
      app_type: appType,
      model_id: modelId,
      prompt: prompt.trim(),
      html: previewHtml,
      metadata: { source: 'moabom-shell', ...(isEditingExisting ? { updated: true } : {}) },
    };

    setIsSaving(true);
    try {
      if (loadedEditId != null) {
        await updateGeneratedApp(loadedEditId, payload);
        setSavedMessage(t('moa_apps_ai.update_success'));
      } else {
        const saved = await storeGeneratedApp(payload);
        setLoadedEditId(saved.id);
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
      <Div className="flex min-h-[320px] w-full items-center justify-center text-faint text-sm" role="status">
        {t('moa_apps_ai.viewer_loading')}
      </Div>
    );
  }

  return (
    <Div className={`moa-shell-app-window ${APP_SHELL_BODY_CLASS}`}>
      {isEditingExisting ? (
        <Div className="mb-3 rounded-2xl bg-violet-500/10 px-3 py-2 text-sm font-bold text-violet-700 dark:text-violet-300">
          {t('moa_apps_ai.editing_saved_app')}
        </Div>
      ) : null}
      <Div className="grid min-h-[420px] flex-1 grid-cols-1 gap-4 @xl:grid-cols-[380px_minmax(0,1fr)]">
        <Div className={`${APP_SHELL_PANEL_CLASS} flex h-full min-h-0 flex-col gap-3`}>
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

          <Label className="flex min-h-[220px] flex-1 flex-col">
            <Div className={`mb-1 ${APP_SHELL_BODY_CLASS}`}>{t('moa_apps_ai.field_prompt')}</Div>
            <Textarea
              className={`${APP_SHELL_TEXTAREA_CLASS} min-h-[220px] flex-1`}
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
            <Button type="button" variant="primary" onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? t('moa_apps_ai.generating') : previewHtml ? t('moa_apps_ai.modify') : t('moa_apps_ai.generate')}
            </Button>
            <Button type="button" variant="secondary" onClick={handleSave} disabled={isSaving || !previewHtml}>
              {isSaving
                ? t('moa_apps_ai.saving')
                : isEditingExisting
                  ? t('moa_apps_ai.update')
                  : t('moa_apps_ai.save')}
            </Button>
          </Div>
        </Div>

        <Div className={`${APP_SHELL_PANEL_CLASS} min-h-0 overflow-hidden`}>
          {previewHtml ? (
            <iframe
              title={t('moa_apps_ai.preview_title')}
              className="h-full min-h-[420px] w-full rounded-2xl border border-white/60 bg-white"
              srcDoc={previewHtml}
              sandbox="allow-scripts"
            />
          ) : (
            <Div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 text-center">
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
