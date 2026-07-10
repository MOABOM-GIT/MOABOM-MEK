import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useCallback } from 'react';
import { resolveWebsiteLink,
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
import {
  detectObviousInfiniteLoopRisk,
  formatGeneratedAppSecurityToast,
  scanGeneratedAppHtmlSecurity,
} from './generatedAppHtmlSecurity';
import { generatedAppFrameSandbox } from '../generated/generatedAppPreviewUrl';
import { useShellWindowAuthStateKey } from '../../shell/ShellWindowAuthContext';
import { loadVisibleGeneratedAppSession, invalidateVisibleGeneratedAppSession } from '../generated/generatedAppVisibleSessionCache';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { pushWarningToast } from '../../runtime/moaShellToasts';
import { Button } from '../../components/basic/Button';
import AppLoadingSpinner from '../../components/composite/AppLoadingSpinner';
import { Div } from '../../components/basic/Div';
import { Icon } from '../../components/basic/Icon';
import { Input } from '../../components/basic/Input';
import { Label } from '../../components/basic/Label';
import { Select } from '../../components/basic/Select';
import { Textarea } from '../../components/basic/Textarea';
import { appendHostedModernStoragePrompt } from './aiGeneratorPrompt';
import {
  APP_SHELL_BODY_CLASS,
  APP_SHELL_DESC_CLASS,
  APP_SHELL_INPUT_CLASS,
  APP_SHELL_PANEL_CLASS,
  APP_SHELL_SELECT_TRIGGER_CLASS,
  APP_SHELL_TEXTAREA_CLASS,
  APP_STACK_CLASS,
  APP_WINDOW_BODY_CLASS,
} from '../appShellTypography';
import { useMoaAppWindowNarrow } from '../../hooks/useMoaAppWindowNarrow';
import { buildGenerationDraftView, resolveGenerationSource } from './aiGenerationDraft';
import {
  prepareGeneratedAppHtmlForPersist,
  toEditorHtmlFromStored,
} from './generatedAppHtmlPipeline';
import { AiGenerationQueuePanel } from './AiGenerationQueuePanel';
import { AiGenerationRecoveryBanner } from './AiGenerationRecoveryBanner';
import { AiGenerationCodePanel } from './AiGenerationCodePanel';
import { AiAppInspectorPanel } from './inspector/AiAppInspectorPanel';
import { injectPreviewInspectorBridge } from './inspector/previewInspectorBridge';
import { AiGenerationSplitHandle } from './AiGenerationSplitHandle';
import { useVerticalSplitPane } from '../../hooks/useVerticalSplitPane';
import { handleMoabomAppFileDownloadMessage } from '../generated/generatedAppIframeBridge';
import { useAiAppStream } from './useAiAppStream';
import { readAiGenerationResumeFormFields } from './aiGenerationResumeForm';
import type { AiGenerationSession } from '../../api/moabomAppsApi';
import {
  buildWebsiteLinkSaveMetadata,
  buildWebsiteLinkStoredHtml,
  isHtmlPasteAppType,
  isWebsiteLinkAppType,
  normalizeWebsiteUrl,
  readWebsiteIconFromMetadata,
  readWebsiteLinkLaunchModeFromMetadata,
  readWebsiteLinkPreviewFromMetadata,
  readWebsitePointColorFromMetadata,
  isWebsiteTitleIconFromMetadata,
  readWebsiteUrlFromMetadata,
  stripWebsiteLinkIconServingMetadata,
  WEBSITE_LINK_LAUNCH_MODE_NEW_WINDOW,
  WEBSITE_LINK_LAUNCH_MODE_WINDOW,
  type WebsiteLinkLaunchMode,
} from './websiteLinkApp';

const websiteLaunchModeOptions: Array<{ value: WebsiteLinkLaunchMode; labelKey: string }> = [
  { value: WEBSITE_LINK_LAUNCH_MODE_WINDOW, labelKey: 'moa_apps_ai.launch_modes.window' },
  { value: WEBSITE_LINK_LAUNCH_MODE_NEW_WINDOW, labelKey: 'moa_apps_ai.launch_modes.new_window' },
];

const appTierOptions: Array<{ value: AppTier; labelKey: string }> = [
  { value: 'standard', labelKey: 'moa_apps_ai.tiers.standard' },
  { value: 'hosted', labelKey: 'moa_apps_ai.tiers.hosted' },
];

const appTypeOptions: Array<{ value: AiAppType; labelKey: string }> = [
  { value: 'general', labelKey: 'moa_apps_ai.types.general' },
  { value: 'html_paste', labelKey: 'moa_apps_ai.types.html_paste' },
  { value: 'website_link', labelKey: 'moa_apps_ai.types.website_link' },
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
const CODE_PREVIEW_DEBOUNCE_MS = 280;

function mergeGeneratedAppMetadata(
  base: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...(base && typeof base === 'object' ? base : {}),
    ...patch,
  };
}

export function AiGeneratorApp() {
  const { t } = useMoabomShellT();
  const authStateKey = useShellWindowAuthStateKey();
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
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [websiteLaunchMode, setWebsiteLaunchMode] = useState<WebsiteLinkLaunchMode>(
    WEBSITE_LINK_LAUNCH_MODE_WINDOW,
  );
  const [resolvedIconUrl, setResolvedIconUrl] = useState('');
  const [resolvedThemeColor, setResolvedThemeColor] = useState('');
  const [resolvedIconFromTitle, setResolvedIconFromTitle] = useState(false);
  const [isResolvingWebsite, setIsResolvingWebsite] = useState(false);
  const codePanelRef = useRef<HTMLDivElement>(null);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const prevEditServerIdRef = useRef<number | null>(null);
  const isWebsiteLink = isWebsiteLinkAppType(appType);
  const isHtmlPaste = isHtmlPasteAppType(appType);
  const hidesAiControls = isWebsiteLink || isHtmlPaste;

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
        const prepared = prepareGeneratedAppHtmlForPersist(draft.source);
        if (prepared.html) {
          setDraftHtml(prepared.html);
        }
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

      if (prepareGeneratedAppHtmlForPersist(draft.source).completeness === 'complete') {
        setNotice('');
      }
    },
  });

  const isGenerationLocked = isStreaming || isQueued;

  const resetCreateForm = useCallback(() => {
    setTitle('');
    setPrompt('');
    setAppType('general');
    setAppTier('standard');
    setModelId('claude-sonnet');
    setDraftHtml('');
    setNotice('');
    setError('');
    setSavedMessage('');
    setWebsiteUrl('');
    setWebsiteLaunchMode(WEBSITE_LINK_LAUNCH_MODE_WINDOW);
    setResolvedIconUrl('');
    setResolvedThemeColor('');
    setResolvedIconFromTitle(false);
    clearStreamedBuffer();
  }, [clearStreamedBuffer]);

  const applyResumeFormFields = useCallback((session: AiGenerationSession) => {
    const fields = readAiGenerationResumeFormFields(session);
    if (fields.title) {
      setTitle(fields.title);
    }
    if (fields.prompt) {
      setPrompt(fields.prompt);
    }
    setAppType(fields.appType);
    setAppTier(fields.appTier);
    setModelId(fields.modelId);
  }, []);

  useEffect(() => {
    if (!editServerId) {
      if (prevEditServerIdRef.current != null) {
        resetCreateForm();
      }
      setLoadedEditId(null);
      setRemixSourceId(null);
      setLoadedSourceApp(null);
      prevEditServerIdRef.current = null;
      return;
    }

    let cancelled = false;
    setIsLoadingEdit(true);
    setError('');
    setSavedMessage('');

    void (async () => {
      try {
        const app = await loadVisibleGeneratedAppSession(editServerId, authStateKey);
        if (cancelled) {
          return;
        }
        const editingOwnApp = app.permissions?.is_owner !== false;
        setTitle(app.title?.trim() || '');
        setPrompt(app.prompt?.trim() || '');
        setAppType(app.app_type ?? 'general');
        setAppTier(
          isWebsiteLinkAppType(app.app_type) || isHtmlPasteAppType(app.app_type)
            ? 'standard'
            : (app.tier ?? 'standard'),
        );
        setModelId(app.model_id ?? 'claude-sonnet');
        setWebsiteUrl(readWebsiteUrlFromMetadata(app.metadata));
        setWebsiteLaunchMode(readWebsiteLinkLaunchModeFromMetadata(app.metadata));
        setResolvedIconUrl(readWebsiteIconFromMetadata(app.metadata));
        setResolvedThemeColor(readWebsitePointColorFromMetadata(app.metadata));
        setResolvedIconFromTitle(isWebsiteTitleIconFromMetadata(app.metadata));
        setDraftHtml(isWebsiteLinkAppType(app.app_type) ? '' : toEditorHtmlFromStored(app.html ?? ''));
        setLoadedEditId(editingOwnApp ? app.id : null);
        setRemixSourceId(editingOwnApp ? null : app.id);
        setLoadedSourceApp(app);
        prevEditServerIdRef.current = editServerId;
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
  }, [authStateKey, editServerId, resetCreateForm, t]);

  // 이어하기 세션이 있으면 배너 노출과 동시에 제목·프롬프트·설정을 폼에 복원한다.
  useEffect(() => {
    if (!resumeChecked || !resumeSession?.partial_raw || editServerId) {
      return;
    }
    applyResumeFormFields(resumeSession);
  }, [applyResumeFormFields, editServerId, resumeChecked, resumeSession]);

  useEffect(() => {
    if (!codePanelRef.current) {
      return;
    }
    codePanelRef.current.scrollTop = codePanelRef.current.scrollHeight;
  }, [streamedRaw, isStreaming]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== previewIframeRef.current?.contentWindow) {
        return;
      }
      if (!handleMoabomAppFileDownloadMessage(event.data)) {
        return;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const draftSource = resolveGenerationSource(draftHtml, streamedRaw, isStreaming);
  const debouncedDraftHtml = useDebouncedValue(draftHtml, CODE_PREVIEW_DEBOUNCE_MS);

  const streamingDraftView = useMemo(
    () => buildGenerationDraftView(draftSource),
    [draftSource],
  );

  const debouncedPrepared = useMemo(
    () => prepareGeneratedAppHtmlForPersist(debouncedDraftHtml),
    [debouncedDraftHtml],
  );

  const persistPrepared = useMemo(
    () => prepareGeneratedAppHtmlForPersist(draftHtml),
    [draftHtml],
  );

  const draftView = isStreaming
    ? streamingDraftView
    : {
        source: debouncedDraftHtml,
        completeness: debouncedPrepared.completeness,
        previewHtml: debouncedPrepared.html,
        saveHtml: debouncedPrepared.html,
        canSave: debouncedPrepared.canSave,
        canContinue: debouncedPrepared.canContinue,
      };

  const previewHtml = draftView.previewHtml;
  /** opaque-origin sandbox 용 Inspector 브릿지 — srcDoc 전용, 저장 HTML 에는 넣지 않음 */
  const iframePreviewHtml = useMemo(
    () => (previewHtml ? injectPreviewInspectorBridge(previewHtml) : ''),
    [previewHtml],
  );
  const codePreview = isStreaming ? draftSource : (draftHtml || debouncedPrepared.html);
  const showCodePreviewPanel = isHtmlPaste || (!isWebsiteLink && (isStreaming || Boolean(codePreview)));
  const hasPreviewContent = Boolean(previewHtml);
  const { narrow: isOneColumn, containerRef: oneColumnRef } = useMoaAppWindowNarrow();
  const splitPane = useVerticalSplitPane({
    enabled: showCodePreviewPanel && hasPreviewContent && !isStreaming,
  });
  const codePaneStyle = (() => {
    if (isStreaming) {
      return { flex: '1 1 0%', minHeight: 0, height: 'auto' as const };
    }
    if (isHtmlPaste) {
      return hasPreviewContent
        ? undefined
        : { flex: '1 1 0%', minHeight: 0, height: 'auto' as const };
    }
    if (!(splitPane.enabled && hasPreviewContent)) {
      return undefined;
    }
    // 1열: flex % 대신 높이(cqh) — 패널이 콘텐츠 높이로 늘어나도 코드/프리뷰가 잠기지 않음
    if (isOneColumn) {
      const codeCqh = 12 + splitPane.ratio * 36;
      return {
        flex: '0 0 auto',
        height: `clamp(10rem, ${codeCqh.toFixed(1)}cqh, 40cqh)`,
      };
    }
    return { flex: `0 0 ${splitPane.codeFlex}` };
  })();
  const previewPaneStyle = (() => {
    if (isStreaming && !hasPreviewContent) {
      return { flex: '0 0 auto' };
    }
    // 1열은 CSS min-height 로 프리뷰 작업 영역 확보 (비율 flex 미사용)
    if (isOneColumn || !(splitPane.enabled && splitPane.previewFlex)) {
      return undefined;
    }
    return { flex: `1 1 ${splitPane.previewFlex}` };
  })();
  const isEditingExisting = loadedEditId != null;
  const isRemixingExisting = remixSourceId != null;
  const needsRecovery = !hidesAiControls && !isStreaming && persistPrepared.canContinue;
  const websitePreviewUrl = isWebsiteLink ? normalizeWebsiteUrl(websiteUrl) : '';
  const canSaveWebsiteLink = Boolean(title.trim() && websiteUrl.trim() && prompt.trim());
  const canSaveHtmlPaste = Boolean(title.trim() && persistPrepared.canSave);

  const handleCodeChange = useCallback((nextCode: string) => {
    clearStreamedBuffer();
    setDraftHtml(nextCode);
  }, [clearStreamedBuffer]);

  const handleCodeCommit = useCallback(() => {
    const prepared = prepareGeneratedAppHtmlForPersist(draftHtml);
    if (prepared.html && prepared.html !== draftHtml) {
      setDraftHtml(prepared.html);
    }
  }, [draftHtml]);

  const handleWebsiteLinkGenerate = async () => {
    setError('');
    setSavedMessage('');
    setNotice('');

    if (!websiteUrl.trim()) {
      setError(t('moa_apps_ai.validation.url_required'));
      return;
    }

    if (!prompt.trim()) {
      setError(t('moa_apps_ai.validation.site_description_required'));
      return;
    }

    setIsResolvingWebsite(true);
    try {
      const resolved = await resolveWebsiteLink(websiteUrl);
      setWebsiteUrl(resolved.url);
      setResolvedIconUrl(resolved.icon_url ?? '');
      setResolvedThemeColor(resolved.theme_color ?? '');
      setResolvedIconFromTitle(resolved.icon_from_title);
      setDraftHtml('');
      clearStreamedBuffer();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('moa_apps_ai.error_website_resolve'));
    } finally {
      setIsResolvingWebsite(false);
    }
  };

  const handleGenerate = async (continueGeneration = false) => {
    if (isHtmlPaste) {
      return;
    }
    if (isWebsiteLink) {
      await handleWebsiteLinkGenerate();
      return;
    }

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
        ? persistPrepared.html || draftSource
        : persistPrepared.html || '';

      await runStream({
        prompt: appendHostedModernStoragePrompt(
          prompt.trim(),
          appTier,
          t('moa_apps_ai.hosted_modern_storage_prompt_addon'),
        ),
        title: title.trim(),
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

  const handleInspectorPatch = (patchPrompt: string) => {
    setPrompt(patchPrompt);
    void (async () => {
      if (isHtmlPaste || isWebsiteLink) {
        return;
      }
      setError('');
      setSavedMessage('');
      setNotice('');
      try {
        const currentHtml = persistPrepared.html || draftSource || '';
        if (!currentHtml.trim()) {
          setError(t('moa_apps_ai.validation.html_required'));
          return;
        }
        await runStream({
          prompt: appendHostedModernStoragePrompt(
            patchPrompt.trim(),
            appTier,
            t('moa_apps_ai.hosted_modern_storage_prompt_addon'),
          ),
          title: title.trim(),
          currentHtml,
          continueGeneration: false,
          generationMode: 'patch',
          existingSessionId: sessionId,
        });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setError(err instanceof Error ? err.message : t('moa_apps_ai.error_generate'));
      }
    })();
  };

  const handleSave = async () => {
    setError('');
    setSavedMessage('');
    if (!title.trim()) {
      setError(t('moa_apps_ai.validation.title_required'));
      return;
    }

    let resolvedSaveHtml = persistPrepared.html;
    const saveCompleteness = persistPrepared.completeness;
    let nextWebsiteUrl = normalizeWebsiteUrl(websiteUrl);
    let nextIconUrl = resolvedIconUrl;
    let nextThemeColor = resolvedThemeColor;
    let nextIconFromTitle = resolvedIconFromTitle;

    if (!resolvedSaveHtml && isWebsiteLink) {
      if (!websiteUrl.trim()) {
        setError(t('moa_apps_ai.validation.url_required'));
        return;
      }
      if (!prompt.trim()) {
        setError(t('moa_apps_ai.validation.site_description_required'));
        return;
      }

      setIsResolvingWebsite(true);
      try {
        const resolved = await resolveWebsiteLink(websiteUrl);
        nextWebsiteUrl = resolved.url;
        nextIconUrl = resolved.icon_url ?? '';
        nextThemeColor = resolved.theme_color ?? '';
        nextIconFromTitle = resolved.icon_from_title;
        resolvedSaveHtml = buildWebsiteLinkStoredHtml(title.trim() || new URL(resolved.url).hostname);
        setWebsiteUrl(resolved.url);
        setResolvedIconUrl(resolved.icon_url ?? '');
        setResolvedThemeColor(resolved.theme_color ?? '');
        setResolvedIconFromTitle(resolved.icon_from_title);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('moa_apps_ai.error_website_resolve'));
        return;
      } finally {
        setIsResolvingWebsite(false);
      }
    }

    if (!resolvedSaveHtml) {
      setError(t('moa_apps_ai.validation.html_required'));
      return;
    }

    if (!isWebsiteLink) {
      const securityScan = scanGeneratedAppHtmlSecurity(resolvedSaveHtml);
      if (!securityScan.ok) {
        const toastMessage = formatGeneratedAppSecurityToast(securityScan.violations, t);
        if (toastMessage) {
          pushWarningToast(toastMessage, 4500);
        }
        setError(t('moa_apps_ai.security.save_blocked'));
        return;
      }
      // 비차단 1차 경고: 명백한 무한 루프 패턴은 저장은 허용하되 사용자에게 알린다.
      // 실행 중 멈춰도 런타임 워치독이 해당 앱만 재시작하므로 셸/브라우저는 안전하다.
      if (detectObviousInfiniteLoopRisk(resolvedSaveHtml)) {
        pushWarningToast(t('moa_apps_ai.security.loop_warning'), 5000);
      }
    }

    const isDraftSave = !hidesAiControls && saveCompleteness === 'partial';
    const metadataBase = isEditingExisting && loadedSourceApp?.metadata && typeof loadedSourceApp.metadata === 'object'
      ? (isWebsiteLink
        ? stripWebsiteLinkIconServingMetadata(loadedSourceApp.metadata as Record<string, unknown>)
        : loadedSourceApp.metadata as Record<string, unknown>)
      : undefined;

    const payload = {
      title: title.trim(),
      app_type: appType,
      tier: hidesAiControls ? 'standard' as const : appTier,
      model_id: hidesAiControls ? null : modelId,
      prompt: prompt.trim(),
      html: resolvedSaveHtml,
      metadata: mergeGeneratedAppMetadata(metadataBase, {
        source: isHtmlPaste ? 'moabom-shell-html-paste' : 'moabom-shell',
        generation_status: hidesAiControls ? 'complete' : saveCompleteness,
        generation_complete: hidesAiControls ? true : saveCompleteness === 'complete',
        ...(isWebsiteLink ? buildWebsiteLinkSaveMetadata({
          websiteUrl: nextWebsiteUrl,
          resolvedIconUrl: nextIconUrl,
          themeColor: nextThemeColor,
          iconFromTitle: nextIconFromTitle,
          launchMode: websiteLaunchMode,
          appId: loadedEditId,
        }) : {}),
        ...(sessionId ? { ai_generation_session_id: sessionId } : {}),
        ...(isEditingExisting ? { updated: true } : {}),
        ...(isRemixingExisting ? { remix_source_id: remixSourceId } : {}),
      }),
      ...(isRemixingExisting ? { parent_app_id: remixSourceId } : {}),
    };

    setIsSaving(true);
    try {
      let savedAppId: number;
      let savedApp: Awaited<ReturnType<typeof storeGeneratedApp>>;
      if (loadedEditId != null) {
        savedApp = await updateGeneratedApp(loadedEditId, payload);
        savedAppId = savedApp.id;
        notifyGeneratedAppSaved(savedApp);
        setSavedMessage(isDraftSave ? t('moa_apps_ai.recovery.save_draft_success') : t('moa_apps_ai.update_success'));
      } else {
        savedApp = await storeGeneratedApp(payload);
        savedAppId = savedApp.id;
        setLoadedEditId(savedApp.id);
        setRemixSourceId(null);
        notifyGeneratedAppSaved(savedApp);
        setSavedMessage(isDraftSave ? t('moa_apps_ai.recovery.save_draft_success') : t('moa_apps_ai.save_success'));
      }

      if (isWebsiteLink && savedApp.metadata && typeof savedApp.metadata === 'object') {
        const preview = readWebsiteLinkPreviewFromMetadata(savedApp.metadata as Record<string, unknown>);
        setResolvedIconUrl(preview.iconUrl);
        setResolvedIconFromTitle(preview.iconFromTitle);
        setResolvedThemeColor(preview.themeColor);
      }
      invalidateVisibleGeneratedAppSession(savedAppId);
      setDraftHtml(resolvedSaveHtml);
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
    <Div ref={oneColumnRef} className={`${APP_WINDOW_BODY_CLASS} ${APP_SHELL_BODY_CLASS}`}>
      {isEditingExisting || isRemixingExisting ? (
        <Div className="rounded-2xl bg-violet-500/10 px-3 py-2 text-sm font-bold text-violet-700 dark:text-violet-300">
          {isEditingExisting
            ? t('moa_apps_ai.editing_saved_app')
            : t('moa_apps_ai.remixing_saved_app', { name: loadedSourceApp?.owner?.nickname ?? '' })}
        </Div>
      ) : null}

      {resumeChecked && resumeSession?.partial_raw && !hidesAiControls ? (
        <Div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          <Div>{t('moa_apps_ai.resume_banner')}</Div>
          <Div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                if (resumeSession) {
                  applyResumeFormFields(resumeSession);
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

      {!hidesAiControls ? (
        <AiGenerationRecoveryBanner
          phase={generationPhase}
          completeness={isStreaming ? streamingDraftView.completeness : persistPrepared.completeness}
          appTier={appTier}
          t={t}
          onContinue={() => void handleGenerate(true)}
          onSaveDraft={() => void handleSave()}
          isSaving={isSaving}
          isStreaming={isStreaming}
        />
      ) : null}

      <Div className="moa-ai-generator-layout">
        <Div className={`${APP_SHELL_PANEL_CLASS} ${APP_STACK_CLASS} moa-ai-form-panel`}>
          <Label className="block">
            <Div className={`mb-1 ${APP_SHELL_BODY_CLASS}`}>{t('moa_apps_ai.field_title')}</Div>
            <Input
              className={inputClassName}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t('moa_apps_ai.field_title_placeholder')}
            />
          </Label>

          <Div className="grid grid-cols-1 gap-3">
            <Label className="block">
              <Div className={`mb-1 ${APP_SHELL_BODY_CLASS}`}>{t('moa_apps_ai.field_type')}</Div>
              <Select
                className={APP_SHELL_SELECT_TRIGGER_CLASS}
                value={appType}
                options={appTypeOptions.map(option => ({ value: option.value, label: t(option.labelKey) }))}
                onChange={(event) => {
                  const nextType = event.target.value as AiAppType;
                  setAppType(nextType);
                  if (isWebsiteLinkAppType(nextType) || isHtmlPasteAppType(nextType)) {
                    setAppTier('standard');
                  }
                }}
                disabled={isGenerationLocked}
              />
            </Label>
            {isWebsiteLink ? (
              <>
                <Label className="block">
                  <Div className={`mb-1 ${APP_SHELL_BODY_CLASS}`}>{t('moa_apps_ai.field_url')}</Div>
                  <Input
                    className={inputClassName}
                    value={websiteUrl}
                    onChange={(event) => setWebsiteUrl(event.target.value)}
                    placeholder={t('moa_apps_ai.field_url_placeholder')}
                    inputMode="url"
                    disabled={isGenerationLocked}
                  />
                </Label>
                <Label className="block">
                  <Div className={`mb-1 ${APP_SHELL_BODY_CLASS}`}>{t('moa_apps_ai.field_launch_mode')}</Div>
                  <Select
                    className={APP_SHELL_SELECT_TRIGGER_CLASS}
                    value={websiteLaunchMode}
                    options={websiteLaunchModeOptions.map(option => ({
                      value: option.value,
                      label: t(option.labelKey),
                    }))}
                    onChange={(event) => {
                      setWebsiteLaunchMode(
                        event.target.value === WEBSITE_LINK_LAUNCH_MODE_NEW_WINDOW
                          ? WEBSITE_LINK_LAUNCH_MODE_NEW_WINDOW
                          : WEBSITE_LINK_LAUNCH_MODE_WINDOW,
                      );
                    }}
                    disabled={isGenerationLocked}
                  />
                </Label>
              </>
            ) : isHtmlPaste ? null : (
              <>
                <Label className="block">
                  <Div className={`mb-1 ${APP_SHELL_BODY_CLASS}`}>{t('moa_apps_ai.field_tier')}</Div>
                  <Select
                    className={APP_SHELL_SELECT_TRIGGER_CLASS}
                    value={appTier}
                    options={appTierOptions.map(option => ({ value: option.value, label: t(option.labelKey) }))}
                    onChange={(event) => {
                      setAppTier(event.target.value as AppTier);
                    }}
                    disabled={isEditingExisting || isGenerationLocked}
                  />
                </Label>
                <Label className="block">
                  <Div className={`mb-1 ${APP_SHELL_BODY_CLASS}`}>{t('moa_apps_ai.field_model')}</Div>
                  <Select
                    className={APP_SHELL_SELECT_TRIGGER_CLASS}
                    value={modelId}
                    options={modelOptions.map(option => ({ value: option.value, label: t(option.labelKey) }))}
                    onChange={(event) => setModelId(String(event.target.value))}
                    disabled={isGenerationLocked}
                  />
                </Label>
              </>
            )}
          </Div>

          <Label className="flex min-h-[180px] flex-1 flex-col">
            <Div className={`mb-1 ${APP_SHELL_BODY_CLASS}`}>
              {isWebsiteLink
                ? t('moa_apps_ai.field_site_description')
                : isHtmlPaste
                  ? t('moa_apps_ai.field_app_description')
                  : t('moa_apps_ai.field_prompt')}
            </Div>
            <Textarea
              className={`${APP_SHELL_TEXTAREA_CLASS} min-h-[180px] flex-1`}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={
                isWebsiteLink
                  ? t('moa_apps_ai.field_site_description_placeholder')
                  : isHtmlPaste
                    ? t('moa_apps_ai.field_app_description_placeholder')
                    : (previewHtml ? t('moa_apps_ai.field_modify_placeholder') : t('moa_apps_ai.field_prompt_placeholder'))
              }
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
            {!isHtmlPaste ? (
              <Button
                type="button"
                variant={previewHtml || websitePreviewUrl ? 'secondary' : 'primary'}
                onClick={() => void handleGenerate(false)}
                disabled={isStreaming || isResolvingWebsite}
              >
                {isWebsiteLink
                  ? (isResolvingWebsite ? t('moa_apps_ai.website_resolving') : t('moa_apps_ai.generate'))
                  : (isQueued ? t('moa_apps_ai.queue.waiting_button') : isStreaming ? t('moa_apps_ai.generating') : previewHtml ? t('moa_apps_ai.modify') : t('moa_apps_ai.generate'))}
              </Button>
            ) : null}
            {!hidesAiControls && isStreaming ? (
              <Button type="button" variant="secondary" onClick={() => void stopGeneration()}>
                {isQueued ? t('moa_apps_ai.queue.cancel') : t('moa_apps_ai.stop_generate')}
              </Button>
            ) : null}
            {!hidesAiControls && needsRecovery ? (
              <Button type="button" variant="secondary" onClick={() => void handleGenerate(true)} disabled={isStreaming}>
                {t('moa_apps_ai.continue_generate')}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleSave()}
              disabled={
                isSaving
                || isResolvingWebsite
                || isStreaming
                || (isWebsiteLink
                  ? !canSaveWebsiteLink
                  : isHtmlPaste
                    ? !canSaveHtmlPaste
                    : !persistPrepared.canSave)
              }
            >
              {isSaving || isResolvingWebsite
                ? t('moa_apps_ai.saving')
                : !isHtmlPaste && persistPrepared.completeness === 'partial'
                  ? t('moa_apps_ai.recovery.save_draft')
                  : isEditingExisting
                    ? t('moa_apps_ai.update')
                    : isRemixingExisting
                      ? t('moa_apps_ai.save_remix')
                      : t('moa_apps_ai.save')}
            </Button>
          </Div>
        </Div>

        <Div
          ref={splitPane.containerRef}
          className={`${APP_SHELL_PANEL_CLASS} moa-ai-preview-panel`}
        >
          {!hidesAiControls && queueState ? (
            <AiGenerationQueuePanel
              queue={queueState}
              t={t}
              onCancel={() => void cancelQueue()}
            />
          ) : null}

          {showCodePreviewPanel ? (
            <Div
              className="moa-ai-split-pane__code"
              style={codePaneStyle}
            >
              <AiGenerationCodePanel
                isStreaming={isStreaming}
                codePreview={codePreview}
                editableCode={draftHtml}
                completeness={isStreaming ? streamingDraftView.completeness : persistPrepared.completeness}
                onCodeChange={handleCodeChange}
                onCodeCommit={handleCodeCommit}
                codeScrollRef={codePanelRef}
                t={t}
                pasteMode={isHtmlPaste}
              />
            </Div>
          ) : null}

          {showCodePreviewPanel && splitPane.enabled && hasPreviewContent ? (
            <AiGenerationSplitHandle
              ariaLabel={t('moa_apps_ai.split_resize')}
              nudgeUpLabel={t('moa_apps_ai.split_nudge_up')}
              nudgeDownLabel={t('moa_apps_ai.split_nudge_down')}
              onPointerDown={splitPane.onHandlePointerDown}
              onPointerMove={splitPane.onHandlePointerMove}
              onPointerUp={splitPane.onHandlePointerUp}
              onNudgeUp={() => splitPane.nudgeRatio(-0.05)}
              onNudgeDown={() => splitPane.nudgeRatio(0.05)}
            />
          ) : null}

          <Div
            className={`moa-ai-preview-stage ${showCodePreviewPanel ? 'moa-ai-split-pane__preview' : ''}`}
            style={previewPaneStyle}
          >
            {!hidesAiControls && !isWebsiteLink && !isHtmlPaste && iframePreviewHtml ? (
              <AiAppInspectorPanel
                enabled
                iframeRef={previewIframeRef}
                previewHtml={iframePreviewHtml}
                disabled={isStreaming || isGenerationLocked}
                onRequestPatch={handleInspectorPatch}
                t={t}
              />
            ) : null}
            {isWebsiteLink && websitePreviewUrl ? (
              <iframe
                title={title.trim() || t('moa_apps_ai.preview_title')}
                className="moa-ai-preview-frame"
                src={websitePreviewUrl}
                sandbox={generatedAppFrameSandbox(websitePreviewUrl, 'website_link')}
              />
            ) : iframePreviewHtml ? (
              <iframe
                ref={previewIframeRef}
                title={t('moa_apps_ai.preview_title')}
                className="moa-ai-preview-frame"
                srcDoc={iframePreviewHtml}
                sandbox="allow-scripts allow-downloads"
              />
            ) : (
              <Div className="moa-ai-preview-empty">
                <Icon name="file-alt" className="text-4xl text-faint" />
                <Div className={APP_SHELL_BODY_CLASS}>{t('moa_apps_ai.preview_empty_title')}</Div>
                <Div className={`max-w-md ${APP_SHELL_DESC_CLASS}`}>
                  {isWebsiteLink
                    ? t('moa_apps_ai.preview_empty_description_website')
                    : isHtmlPaste
                      ? t('moa_apps_ai.preview_empty_description_paste')
                      : t('moa_apps_ai.preview_empty_description')}
                </Div>
              </Div>
            )}
          </Div>
        </Div>
      </Div>
    </Div>
  );
}
