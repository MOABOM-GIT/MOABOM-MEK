import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMoabomShellT } from 'moabom-shell-i18n';
import { Button } from '../../components/basic/Button';
import { Div } from '../../components/basic/Div';
import { Icon } from '../../components/basic/Icon';
import { Select } from '../../components/basic/Select';
import { Span } from '../../components/basic/Span';
import { Textarea } from '../../components/basic/Textarea';
import { AppLoadingSpinner } from '../../components/composite/AppLoadingSpinner';
import {
  buildSmartChatHandoffPrompt,
  createSmartChatConversation,
  createSmartChatFolder,
  createSmartChatMemory,
  deleteSmartChatConversation,
  deleteSmartChatFolder,
  deleteSmartChatMemory,
  disableSmartChatShare,
  enableSmartChatShare,
  fetchSmartChatConversations,
  fetchSmartChatFolders,
  fetchSmartChatGeneratedApps,
  fetchSmartChatMemories,
  fetchSmartChatMessages,
  fetchSmartChatModels,
  fetchSmartChatPreferences,
  saveSmartChatPreferences,
  streamSmartChatMessage,
  updateSmartChatConversation,
  uploadSmartChatAttachment,
  type SmartChatAttachment,
  type SmartChatConversation,
  type SmartChatFolder,
  type SmartChatGeneratedAppOption,
  type SmartChatMemory,
  type SmartChatMessage,
  type SmartChatModel,
} from '../../api/moabomSmartChatApi';
import {
  MoabomShellAuthRequiredError,
  MoabomShellModuleApiError,
} from '../../api/moabomShellHttp';
import { openMoabomShellApp } from '../../shell/openMoabomShellApp';
import { useShellWindowAuthStateKey } from '../../shell/ShellWindowAuthContext';
import {
  APP_SHELL_BODY_CLASS,
  APP_SHELL_PANEL_CLASS,
  APP_STACK_CLASS,
  APP_WINDOW_BODY_CLASS,
} from '../appShellTypography';
import { moaFieldSelectTriggerClass, moaFieldTextareaClass } from '../../theme/moabomFieldSurface';

const QUICK_START_KEYS = [
  'moa_smart_chat.chip_summarize',
  'moa_smart_chat.chip_translate',
  'moa_smart_chat.chip_brainstorm',
  'moa_smart_chat.chip_rewrite',
] as const;

const ATTACH_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,.txt,.md,.csv,application/pdf,.pdf';
const MAX_ATTACHMENTS = 4;

/** 백엔드 function calling 도구명 → 조회 상태 문구 i18n 키 */
const TOOL_STATUS_LABEL_KEYS: Record<string, string> = {
  get_weather: 'moa_smart_chat.tool_status_weather',
  get_my_profile: 'moa_smart_chat.tool_status_profile',
  get_my_credit: 'moa_smart_chat.tool_status_credit',
  get_popular_apps: 'moa_smart_chat.tool_status_apps',
  query_platform_data: 'moa_smart_chat.tool_status_generic',
  search_web: 'moa_smart_chat.tool_status_web',
};

/** 답변 하단 참고 데이터 칩 — 도구명 → 짧은 라벨 i18n 키 */
const TOOL_CHIP_LABEL_KEYS: Record<string, string> = {
  get_weather: 'moa_smart_chat.tool_chip_weather',
  get_my_profile: 'moa_smart_chat.tool_chip_profile',
  get_my_credit: 'moa_smart_chat.tool_chip_credit',
  get_popular_apps: 'moa_smart_chat.tool_chip_apps',
  query_platform_data: 'moa_smart_chat.tool_chip_data',
  search_web: 'moa_smart_chat.tool_chip_web',
  generated_app: 'moa_smart_chat.tool_chip_generated_app',
};

type PendingAttachment = SmartChatAttachment & { previewUrl?: string };

function formatMessageBody(content: string): string {
  return content.trim();
}

/** 대화 목록 보조 라벨 — 로케일 상대 시각 (1분 전, 어제 …), 일주일 초과는 M.D */
function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const locale = document.documentElement.lang || undefined;
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (abs < 60) return rtf.format(0, 'second');
    if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
    if (abs < 86400 * 7) return rtf.format(Math.round(diffSec / 86400), 'day');
  } catch {
    // Intl 미지원 시 날짜로 폴백
  }
  const d = new Date(iso);
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

function downloadText(filename: string, body: string): void {
  const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** 대화 내보내기 — 일반 이용자에게 익숙한 txt 형식 */
function buildExportBody(messages: SmartChatMessage[], title: string): string {
  const lines: string[] = [title, ''];
  for (const m of messages) {
    const role = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : m.role;
    lines.push(`[${role}]`, m.content, '');
  }
  return lines.join('\n');
}

function setCreateAppHandoff(payload: { title?: string | null; prompt: string }): void {
  const api = (window as unknown as {
    __MoabomCreateAppPrompt?: {
      setCreateAppHandoffPrompt?: (
        promptOrPayload: string | { title: string | null; prompt: string },
        title?: string | null,
      ) => void;
    };
  }).__MoabomCreateAppPrompt;
  api?.setCreateAppHandoffPrompt?.({
    title: payload.title?.trim() || null,
    prompt: payload.prompt,
  });
}

export function AiSmartChatApp() {
  const { t } = useMoabomShellT();
  const authStateKey = useShellWindowAuthStateKey();
  const listRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** 전송 중 직접 생성한 대화 — activeUuid effect의 재조회를 1회 건너뜀 (낙관적 메시지 유실·웰컴 깜빡임 방지) */
  const justCreatedRef = useRef<string | null>(null);
  /** 대화별 메시지 캐시 — 재방문 시 즉시 표시 후 백그라운드 재검증 (stale-while-revalidate) */
  const messagesCacheRef = useRef<Map<string, SmartChatMessage[]>>(new Map());
  const activeUuidRef = useRef<string | null>(null);

  const [models, setModels] = useState<SmartChatModel[]>([]);
  const [modelId, setModelId] = useState('gemini-flash-lite');
  const [conversations, setConversations] = useState<SmartChatConversation[]>([]);
  const [activeUuid, setActiveUuid] = useState<string | null>(null);
  const [messages, setMessages] = useState<SmartChatMessage[]>([]);
  /** messages 가 어느 대화의 것인지 — activeUuid 와 다르면 "로딩 중" (동기 파생이라 깜빡임 없음) */
  const [loadedConvUuid, setLoadedConvUuid] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [convListLoading, setConvListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [instructionsDraft, setInstructionsDraft] = useState('');
  const [instructionsSaving, setInstructionsSaving] = useState(false);
  // 웹검색은 툴바 턴 토글만 사용 — 기본 OFF (사이트 데이터는 백엔드가 기본 제공)
  const [webSearch, setWebSearch] = useState(false);
  const [generatedApps, setGeneratedApps] = useState<SmartChatGeneratedAppOption[]>([]);
  const [generatedAppId, setGeneratedAppId] = useState<number | null>(null);
  const [branchParentId, setBranchParentId] = useState<number | null>(null);
  const [lastSources, setLastSources] = useState<Array<{ title: string; url: string }>>([]);
  const [lastUsedTools, setLastUsedTools] = useState<string[]>([]);
  const [folders, setFolders] = useState<SmartChatFolder[]>([]);
  const [activeFolderUuid, setActiveFolderUuid] = useState<string | null>(null);
  const [memories, setMemories] = useState<SmartChatMemory[]>([]);
  const [memoryDraft, setMemoryDraft] = useState('');
  const [folderDraft, setFolderDraft] = useState('');
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [shareInfo, setShareInfo] = useState<SmartChatConversation['share'] | null>(null);
  /** 공유 토글 요청 진행 중 — 버튼 스피너용 */
  const [shareBusy, setShareBusy] = useState(false);
  /** 공유 링크 복사 완료 잠깐 표시 */
  const [shareCopied, setShareCopied] = useState(false);
  const [lastUsage, setLastUsage] = useState<{ prompt?: number | null; completion?: number | null } | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const [rememberedIds, setRememberedIds] = useState<ReadonlySet<number>>(new Set());
  const [rememberingId, setRememberingId] = useState<number | null>(null);
  /** "이 답으로 앱 만들기" — 앱 제작 프롬프트 요약 생성 중인 메시지 id */
  const [handoffId, setHandoffId] = useState<number | null>(null);
  /** AI가 도구(플랫폼 데이터)를 조회 중일 때 도구명 — 타이핑 인디케이터 문구용 */
  const [activeToolName, setActiveToolName] = useState<string | null>(null);

  const messagesLoading = activeUuid != null && loadedConvUuid !== activeUuid;

  useEffect(() => {
    activeUuidRef.current = activeUuid;
  }, [activeUuid]);

  const visibleMessages = useMemo(() => {
    if (branchParentId == null) return messages;
    return messages.filter(m => m.id <= branchParentId);
  }, [branchParentId, messages]);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const refreshConversations = useCallback(async (folderUuid?: string | null) => {
    const list = await fetchSmartChatConversations(50, folderUuid ?? undefined);
    setConversations(list);
    return list;
  }, []);

  const clearPendingAttachments = useCallback(() => {
    setPendingAttachments(prev => {
      for (const a of prev) {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      }
      return [];
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [modelPayload, prefs, apps, folderList, memoryList] = await Promise.all([
          fetchSmartChatModels(),
          fetchSmartChatPreferences().catch(() => ({
            custom_instructions: '',
            enabled_tools: [] as string[],
            web_search_enabled: false,
          })),
          fetchSmartChatGeneratedApps().catch(() => [] as SmartChatGeneratedAppOption[]),
          fetchSmartChatFolders().catch(() => [] as SmartChatFolder[]),
          fetchSmartChatMemories().catch(() => [] as SmartChatMemory[]),
        ]);
        if (cancelled) return;
        setModels(modelPayload.models ?? []);
        setModelId(modelPayload.default_model_id || 'gemini-flash-lite');
        setInstructionsDraft(prefs.custom_instructions ?? '');
        setGeneratedApps(apps);
        setFolders(folderList);
        setMemories(memoryList);
        const list = await refreshConversations(null);
        if (cancelled) return;
        if (list[0] && !activeUuid) {
          setActiveUuid(list[0].uuid);
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof MoabomShellAuthRequiredError) {
          setError(t('moa_smart_chat.auth_required'));
        } else {
          setError(e instanceof Error ? e.message : t('moa_smart_chat.load_failed'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auth gate only
  }, [authStateKey, refreshConversations, t]);

  useEffect(() => {
    if (!activeUuid) {
      setMessages([]);
      setBranchParentId(null);
      setLoadedConvUuid(null);
      return;
    }
    // 전송/새 대화 중 방금 만든 대화 — 서버에 아직 메시지가 없어 재조회하면 낙관적 메시지가 지워지고 웰컴이 깜빡임
    if (justCreatedRef.current === activeUuid) {
      justCreatedRef.current = null;
      setLoadedConvUuid(activeUuid);
      return;
    }
    const cached = messagesCacheRef.current.get(activeUuid);
    if (cached) {
      setMessages(cached);
      setLoadedConvUuid(activeUuid);
      setBranchParentId(null);
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchSmartChatMessages(activeUuid);
        if (cancelled) return;
        const rows = data.messages ?? [];
        messagesCacheRef.current.set(activeUuid, rows);
        setMessages(rows);
        setLoadedConvUuid(activeUuid);
        if (!cached) setBranchParentId(null);
        setShareInfo(data.conversation?.share ?? null);
        if (data.conversation?.model_id) {
          setModelId(data.conversation.model_id);
        }
      } catch (e) {
        if (!cancelled) {
          // 스피너가 무한 유지되지 않도록 로드 완료로 처리하고 에러만 표시
          setLoadedConvUuid(activeUuid);
          setError(e instanceof Error ? e.message : t('moa_smart_chat.load_failed'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeUuid, t]);

  useEffect(() => {
    // showInstructions 가 닫히면 메시지 영역이 다시 마운트되므로 스크롤을 복원한다
    if (!showInstructions) scrollToBottom();
  }, [visibleMessages, streamingText, busy, showInstructions, scrollToBottom]);

  useEffect(() => () => {
    clearPendingAttachments();
  }, [clearPendingAttachments]);

  const handleStop = useCallback(() => {
    const uuid = activeUuidRef.current;
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setStreamingText('');
    if (uuid) {
      void fetchSmartChatMessages(uuid)
        .then(data => {
          const rows = data.messages ?? [];
          messagesCacheRef.current.set(uuid, rows);
          if (activeUuidRef.current !== uuid) return;
          setMessages(rows);
          setShareInfo(data.conversation?.share ?? null);
        })
        .catch(() => {});
    }
  }, []);

  const handleNewChat = useCallback(async () => {
    if (busy) handleStop();
    setError(null);
    clearPendingAttachments();
    setBranchParentId(null);
    setLastSources([]);
    setLastUsedTools([]);
    setShareInfo(null);
    try {
      const conversation = await createSmartChatConversation(modelId, activeFolderUuid);
      justCreatedRef.current = conversation.uuid;
      setConversations(prev => [conversation, ...prev]);
      setActiveUuid(conversation.uuid);
      setLoadedConvUuid(conversation.uuid);
      setMessages([]);
      setStreamingText('');
      setShareInfo(conversation.share ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('moa_smart_chat.create_failed'));
    }
  }, [activeFolderUuid, busy, clearPendingAttachments, handleStop, modelId, t]);

  const handleSelectConversation = useCallback((uuid: string) => {
    if (uuid === activeUuidRef.current) return;
    if (busy) handleStop();
    clearPendingAttachments();
    setBranchParentId(null);
    setLastSources([]);
    setLastUsedTools([]);
    setLastUsage(null);
    setActiveUuid(uuid);
  }, [busy, clearPendingAttachments, handleStop]);

  const handleSelectFolder = useCallback(async (folderUuid: string | null) => {
    if (busy) handleStop();
    setActiveFolderUuid(folderUuid);
    setActiveUuid(null);
    setMessages([]);
    setConvListLoading(true);
    try {
      const list = await refreshConversations(folderUuid);
      if (list[0]) setActiveUuid(list[0].uuid);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('moa_smart_chat.load_failed'));
    } finally {
      setConvListLoading(false);
    }
  }, [busy, handleStop, refreshConversations, t]);

  const handleCreateFolder = useCallback(async () => {
    const name = folderDraft.trim();
    if (!name) return;
    try {
      const folder = await createSmartChatFolder(name);
      setFolders(prev => [...prev, folder]);
      setFolderDraft('');
      setShowFolderInput(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('moa_smart_chat.folder_failed'));
    }
  }, [folderDraft, t]);

  const handleDeleteFolder = useCallback(async (uuid: string) => {
    try {
      await deleteSmartChatFolder(uuid);
      setFolders(prev => prev.filter(f => f.uuid !== uuid));
      if (activeFolderUuid === uuid) {
        await handleSelectFolder(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('moa_smart_chat.folder_failed'));
    }
  }, [activeFolderUuid, handleSelectFolder, t]);

  const handleToggleShare = useCallback(async () => {
    if (!activeUuid || shareBusy) return;
    setShareBusy(true);
    try {
      if (shareInfo?.enabled) {
        await disableSmartChatShare(activeUuid);
        setShareInfo({ enabled: false, share_token: null, share_path: null, share_url: null });
        setShareCopied(false);
      } else {
        const share = await enableSmartChatShare(activeUuid);
        setShareInfo(share);
        // 링크를 바로 클립보드에 복사해 "동작했다"는 피드백을 준다
        const url = share.share_url || (share.share_path ? `${window.location.origin}${share.share_path}` : '');
        if (url) {
          try {
            await navigator.clipboard.writeText(url);
            setShareCopied(true);
            window.setTimeout(() => setShareCopied(false), 2000);
          } catch {
            // 클립보드 미지원 — 링크 행에서 수동 복사 가능
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('moa_smart_chat.share_failed'));
    } finally {
      setShareBusy(false);
    }
  }, [activeUuid, shareBusy, shareInfo?.enabled, t]);

  const handleRemember = useCallback(async (messageId: number, content: string) => {
    const text = content.trim();
    if (!text || rememberingId !== null || rememberedIds.has(messageId)) return;
    setRememberingId(messageId);
    try {
      // 전문을 넘기면 서버가 핵심 팩트만 요약해 저장한다 (짧은 내용은 그대로)
      const memory = await createSmartChatMemory(text.slice(0, 20000), activeUuid, true);
      setMemories(prev => [memory, ...prev]);
      setRememberedIds(prev => {
        const next = new Set(prev);
        next.add(messageId);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('moa_smart_chat.memory_failed'));
    } finally {
      setRememberingId(null);
    }
  }, [activeUuid, rememberedIds, rememberingId, t]);

  const handleAddMemoryDraft = useCallback(async () => {
    const text = memoryDraft.trim();
    if (!text) return;
    try {
      const memory = await createSmartChatMemory(text, activeUuid);
      setMemories(prev => [memory, ...prev]);
      setMemoryDraft('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('moa_smart_chat.memory_failed'));
    }
  }, [activeUuid, memoryDraft, t]);

  const handleDeleteMemory = useCallback(async (uuid: string) => {
    try {
      await deleteSmartChatMemory(uuid);
      setMemories(prev => prev.filter(m => m.uuid !== uuid));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('moa_smart_chat.memory_failed'));
    }
  }, [t]);

  const handleMoveToFolder = useCallback(async (folderUuid: string | null) => {
    if (!activeUuid) return;
    try {
      const updated = await updateSmartChatConversation(activeUuid, {
        folder_uuid: folderUuid ?? 'none',
      });
      setConversations(prev => prev.map(c => (c.uuid === updated.uuid ? updated : c)));
      if (activeFolderUuid && updated.folder_uuid !== activeFolderUuid) {
        setConversations(prev => prev.filter(c => c.uuid !== updated.uuid));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('moa_smart_chat.folder_failed'));
    }
  }, [activeFolderUuid, activeUuid, t]);

  const handleDelete = useCallback(async (uuid: string) => {
    try {
      await deleteSmartChatConversation(uuid);
      messagesCacheRef.current.delete(uuid);
      const next = conversations.filter(c => c.uuid !== uuid);
      setConversations(next);
      if (activeUuid === uuid) {
        clearPendingAttachments();
        setBranchParentId(null);
        setActiveUuid(next[0]?.uuid ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('moa_smart_chat.delete_failed'));
    }
  }, [activeUuid, clearPendingAttachments, conversations, t]);

  const handleCopyShare = useCallback(async () => {
    const url = shareInfo?.share_url || (shareInfo?.share_path
      ? `${window.location.origin}${shareInfo.share_path}`
      : '');
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      setError(t('moa_smart_chat.share_copy_failed'));
    }
  }, [shareInfo?.share_path, shareInfo?.share_url, t]);

  const handleCopyMessage = useCallback(async (id: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(id);
      window.setTimeout(() => {
        setCopiedMessageId(prev => (prev === id ? null : prev));
      }, 1500);
    } catch {
      // 클립보드 미지원/거부 시 무시
    }
  }, []);

  const handlePickFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length || busy) return;
    const remaining = MAX_ATTACHMENTS - pendingAttachments.length;
    if (remaining <= 0) {
      setError(t('moa_smart_chat.attach_limit'));
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const slice = Array.from(files).slice(0, remaining);
      const uploaded: PendingAttachment[] = [];
      for (const file of slice) {
        const attachment = await uploadSmartChatAttachment(file, activeUuid);
        uploaded.push({
          ...attachment,
          previewUrl: attachment.kind === 'image' ? URL.createObjectURL(file) : undefined,
        });
      }
      setPendingAttachments(prev => [...prev, ...uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('moa_smart_chat.attach_failed'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [activeUuid, busy, pendingAttachments.length, t]);

  const removePending = useCallback((uuid: string) => {
    setPendingAttachments(prev => {
      const next: PendingAttachment[] = [];
      for (const a of prev) {
        if (a.uuid === uuid) {
          if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
        } else {
          next.push(a);
        }
      }
      return next;
    });
  }, []);

  const handleSaveInstructions = useCallback(async () => {
    setInstructionsSaving(true);
    setError(null);
    try {
      const saved = await saveSmartChatPreferences({
        custom_instructions: instructionsDraft,
      });
      setInstructionsDraft(saved.custom_instructions ?? '');
      setShowInstructions(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('moa_smart_chat.instructions_save_failed'));
    } finally {
      setInstructionsSaving(false);
    }
  }, [instructionsDraft, t]);

  const handleExport = useCallback(() => {
    const rows = visibleMessages;
    if (rows.length === 0) return;
    const active = conversations.find(c => c.uuid === activeUuid);
    const title = active?.title || t('moa_smart_chat.untitled');
    const safe = title.replace(/[^\w가-힣\-]+/g, '_').slice(0, 40) || 'chat';
    downloadText(`${safe}.txt`, buildExportBody(rows, title));
  }, [activeUuid, conversations, t, visibleMessages]);

  const handleBranchFrom = useCallback((messageId: number) => {
    setBranchParentId(messageId);
    setDraft('');
    setError(null);
  }, []);

  /**
   * "관련 앱 만들기" — 질문+답변을 백엔드 LLM 으로 앱 제목·제작 프롬프트로 요약한 뒤 생성기에 채워 넣는다.
   * 요약 실패 시 질문+답변을 구조화한 폴백 프롬프트로 이어간다.
   */
  const handleHandoff = useCallback(async (message: SmartChatMessage) => {
    const answer = message.content.trim();
    if (!answer || handoffId !== null) return;

    // 이 답변 직전의 사용자 질문 찾기
    const idx = visibleMessages.findIndex(m => m.id === message.id && m.role === message.role);
    let question = '';
    for (let i = (idx >= 0 ? idx : visibleMessages.length) - 1; i >= 0; i -= 1) {
      if (visibleMessages[i].role === 'user') {
        question = visibleMessages[i].content.trim();
        break;
      }
    }

    setHandoffId(message.id);
    let title = '';
    let prompt = '';
    try {
      const handoff = await buildSmartChatHandoffPrompt(question, answer);
      title = handoff.title;
      prompt = handoff.prompt;
    } catch {
      title = '';
      prompt = '';
    } finally {
      setHandoffId(null);
    }
    if (!prompt) {
      prompt = question
        ? `${t('moa_smart_chat.handoff_fallback_prefix')}\n\n[Q]\n${question}\n\n[A]\n${answer}`
        : answer;
    }
    if (!title) {
      const source = (question || answer).replace(/\s+/g, ' ').trim();
      title = source.length <= 24 ? source : source.slice(0, 24);
    }
    setCreateAppHandoff({ title, prompt });
    openMoabomShellApp('create-app');
  }, [handoffId, t, visibleMessages]);

  const handleSend = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? draft).trim();
    const attachmentUuids = pendingAttachments.map(a => a.uuid);
    if ((!text && attachmentUuids.length === 0) || busy || uploading) return;

    setError(null);
    setBusy(true);
    if (overrideText === undefined) setDraft('');

    let uuid = activeUuid;
    const parentForTurn = branchParentId;
    try {
      if (!uuid) {
        const conversation = await createSmartChatConversation(modelId, activeFolderUuid);
        uuid = conversation.uuid;
        justCreatedRef.current = uuid;
        setConversations(prev => [conversation, ...prev]);
        setActiveUuid(uuid);
        setLoadedConvUuid(uuid);
      }

      const displayText = text
        || (attachmentUuids.length
          ? t('moa_smart_chat.attach_only_label')
          : '');
      const optimisticUser: SmartChatMessage = {
        id: -Date.now(),
        role: 'user',
        content: displayText,
        status: 'complete',
        parent_id: parentForTurn,
      };
      setMessages(prev => {
        const base = parentForTurn != null ? prev.filter(m => m.id <= parentForTurn) : prev;
        return [...base, optimisticUser];
      });
      setBranchParentId(null);
      setStreamingText('');
      setLastSources([]);
      setLastUsedTools([]);
      clearPendingAttachments();

      const ac = new AbortController();
      abortRef.current = ac;

      await streamSmartChatMessage(
        uuid,
        text,
        modelId,
        {
          onDelta: (_chunk, accumulated) => {
            setActiveToolName(null);
            setStreamingText(accumulated);
          },
          onTool: (name, status) => {
            setActiveToolName(status === 'running' ? name : null);
          },
          onDone: payload => {
            if (payload.sources?.length) {
              setLastSources(payload.sources);
            }
            setLastUsedTools((payload.tools ?? []).filter(name => name in TOOL_CHIP_LABEL_KEYS));
            const usage = payload.usage;
            if (usage) {
              setLastUsage({
                prompt: usage.prompt_tokens,
                completion: usage.completion_tokens,
              });
            }
            if (payload.credit?.error) {
              setError(t('moa_smart_chat.credit_settle_failed'));
            }
            if (payload.finish_reason === 'cancelled') {
              // Stop: partial/cancelled row already persisted
            } else if (payload.finish_reason && ['no_key', 'error', 'unsupported'].includes(payload.finish_reason)) {
              setError(t('moa_smart_chat.send_failed'));
            }
            if (payload.conversation) {
              setConversations(prev => {
                const rest = prev.filter(c => c.uuid !== payload.conversation.uuid);
                return [payload.conversation, ...rest];
              });
              setShareInfo(payload.conversation.share ?? null);
            }
            // 스트림 종료 즉시 답변을 목록에 반영 — 재조회 완료 전 답변이 사라지는 깜빡임 방지
            if (payload.assistant_message) {
              setMessages(prev => [...prev, payload.assistant_message]);
            }
            setStreamingText('');
            // 백그라운드 정규화 (낙관적 id → 실제 id, 제목 갱신)
            const doneUuid = uuid!;
            void fetchSmartChatMessages(doneUuid).then(data => {
              const rows = data.messages ?? [];
              messagesCacheRef.current.set(doneUuid, rows);
              if (activeUuidRef.current !== doneUuid) return;
              setMessages(rows);
            }).catch(() => {});
          },
          onError: (message) => setError(message),
        },
        ac.signal,
        {
          attachmentUuids,
          parentId: parentForTurn,
          generatedAppId,
          // tools 미지정 → 백엔드가 계정 권한 범위 플랫폼 데이터 전체를 기본 제공
          webSearch,
        },
      );
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') {
        if (uuid) {
          const abortedUuid = uuid;
          void fetchSmartChatMessages(abortedUuid)
            .then(data => {
              const rows = data.messages ?? [];
              messagesCacheRef.current.set(abortedUuid, rows);
              if (activeUuidRef.current !== abortedUuid) return;
              setMessages(rows);
              setShareInfo(data.conversation?.share ?? null);
            })
            .catch(() => {});
        }
      } else if (e instanceof MoabomShellModuleApiError || e instanceof Error) {
        setError(e.message);
      } else {
        setError(t('moa_smart_chat.send_failed'));
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      setStreamingText('');
      setActiveToolName(null);
    }
  }, [
    activeFolderUuid,
    activeUuid,
    branchParentId,
    busy,
    clearPendingAttachments,
    draft,
    generatedAppId,
    modelId,
    pendingAttachments,
    t,
    uploading,
    webSearch,
  ]);

  const canSend = Boolean(draft.trim() || pendingAttachments.length) && !busy && !uploading;
  const modelOptions = models.map(m => ({
    value: m.id,
    label: m.label || m.id,
  }));
  const appOptions = [
    { value: '', label: t('moa_smart_chat.app_none') },
    ...generatedApps.map(a => ({
      value: String(a.id),
      label: a.title || `#${a.id}`,
    })),
  ];
  const draftRows = Math.min(4, Math.max(1, draft.split('\n').length));
  // 부트·메시지 로드·대화목록 로드·전송 중에는 웰컴을 숨김 — 상태 전환 사이 빈 프레임 깜빡임 방지
  const showWelcome = !loading && !busy && !messagesLoading && !convListLoading
    && visibleMessages.length === 0 && !streamingText;
  const showMessageList = !loading && !messagesLoading;

  return (
    <Div className={`${APP_WINDOW_BODY_CLASS} ${APP_SHELL_BODY_CLASS}`}>
      <Div className="moa-ai-generator-layout moa-ai-smart-chat-layout">
        <Div className={`${APP_SHELL_PANEL_CLASS} ${APP_STACK_CLASS} moa-ai-form-panel moa-ai-smart-chat-sidebar`}>
          <Button
            type="button"
            size="sm"
            variant="primary"
            className="w-full"
            onClick={() => void handleNewChat()}
          >
            <Icon name="plus" size="sm" />
            <Span className="ml-1.5">{t('moa_smart_chat.new_chat')}</Span>
          </Button>

          <Div className="moa-ai-smart-chat-folders">
            <Span className="mb-1 block text-xs text-faint">{t('moa_smart_chat.folders')}</Span>
            <Div className="flex flex-wrap items-center gap-1">
              <Button
                type="button"
                size="xs"
                variant={activeFolderUuid == null ? 'secondary' : 'primary-outline'}
                onClick={() => void handleSelectFolder(null)}
              >
                {t('moa_smart_chat.folder_all')}
              </Button>
              {folders.map(f => (
                <Div key={f.uuid} className="flex min-w-0 items-center">
                  <Button
                    type="button"
                    size="xs"
                    variant={activeFolderUuid === f.uuid ? 'secondary' : 'primary-outline'}
                    className="max-w-[9rem]"
                    onClick={() => void handleSelectFolder(f.uuid)}
                  >
                    <Span className="truncate">{f.name}</Span>
                  </Button>
                  {activeFolderUuid === f.uuid ? (
                    <Button
                      type="button"
                      size="xs"
                      variant="primary-outline"
                      className="ml-0.5"
                      onClick={() => void handleDeleteFolder(f.uuid)}
                      aria-label={t('moa_smart_chat.folder_delete')}
                      title={t('moa_smart_chat.folder_delete')}
                    >
                      <Icon name="xmark" size="sm" />
                    </Button>
                  ) : null}
                </Div>
              ))}
              <Button
                type="button"
                size="xs"
                variant="primary-outline"
                onClick={() => setShowFolderInput(v => !v)}
                aria-label={t('moa_smart_chat.folder_new')}
                title={t('moa_smart_chat.folder_new')}
              >
                <Icon name="plus" size="sm" />
              </Button>
            </Div>
            {showFolderInput ? (
              <Div className="mt-1 flex gap-1">
                <input
                  value={folderDraft}
                  onChange={e => setFolderDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') void handleCreateFolder();
                  }}
                  placeholder={t('moa_smart_chat.folder_new')}
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-secondary"
                  autoFocus
                />
                <Button type="button" size="xs" variant="secondary" onClick={() => void handleCreateFolder()}>
                  <Icon name="check" size="sm" />
                </Button>
              </Div>
            ) : null}
          </Div>

          <Span className="block text-xs text-faint">{t('moa_smart_chat.chats')}</Span>
          <Div className="min-h-0 flex-1 overflow-y-auto">
            {convListLoading ? (
              <AppLoadingSpinner compact label={t('moa_smart_chat.loading')} className="px-2 py-1.5" />
            ) : conversations.length === 0 ? (
              <Span className="block px-2 py-1.5 text-xs text-faint">{t('moa_smart_chat.empty_chats')}</Span>
            ) : (
              conversations.map(c => {
                const timeLabel = formatRelativeTime(c.last_message_at ?? c.updated_at);
                return (
                  <Div
                    key={c.uuid}
                    className={`moa-ai-smart-chat-conv-item ${activeUuid === c.uuid ? 'is-active' : ''}`}
                  >
                    <Button
                      type="button"
                      className="moa-ai-smart-chat-conv-item__label flex-col items-start justify-center text-left"
                      onClick={() => handleSelectConversation(c.uuid)}
                    >
                      <Span className="moa-ai-smart-chat-conv-item__title text-sm text-secondary">
                        {c.title || t('moa_smart_chat.untitled')}
                      </Span>
                      {timeLabel ? (
                        <Span className="moa-ai-smart-chat-conv-item__time text-xs text-faint">
                          {timeLabel}
                        </Span>
                      ) : null}
                    </Button>
                    <Button
                      type="button"
                      className="moa-ai-smart-chat-conv-item__delete text-faint hover:text-secondary"
                      onClick={() => void handleDelete(c.uuid)}
                      aria-label={t('moa_smart_chat.delete')}
                      title={t('moa_smart_chat.delete')}
                    >
                      <Icon name="trash" size="sm" />
                    </Button>
                  </Div>
                );
              })
            )}
          </Div>
        </Div>

        <Div className={`${APP_SHELL_PANEL_CLASS} moa-ai-preview-panel moa-ai-smart-chat-main`}>
          <Div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-2">
            <Span className="text-xs text-faint">{t('moa_smart_chat.model')}</Span>
            <Select
              value={modelId}
              onChange={e => setModelId(e.target.value)}
              options={modelOptions.length ? modelOptions : [{ value: modelId, label: modelId }]}
              className={`${moaFieldSelectTriggerClass('sm')} max-w-[180px]`}
              disabled={busy}
            />
            <Select
              value={generatedAppId != null ? String(generatedAppId) : ''}
              onChange={e => {
                const v = e.target.value;
                setGeneratedAppId(v ? Number(v) : null);
              }}
              options={appOptions}
              className={`${moaFieldSelectTriggerClass('sm')} max-w-[180px]`}
              disabled={busy}
            />
            <Button
              type="button"
              size="sm"
              variant={webSearch ? 'primary-outline' : 'dark-outline'}
              onClick={() => setWebSearch(v => !v)}
              disabled={busy}
              aria-pressed={webSearch}
              title={t('moa_smart_chat.web_search')}
            >
              <Icon name={webSearch ? 'check' : 'globe'} size="sm" />
              <Span className="ml-1 hidden sm:inline">{t('moa_smart_chat.web_search')}</Span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant={shareInfo?.enabled ? 'secondary' : 'primary-outline'}
              onClick={() => void handleToggleShare()}
              disabled={!activeUuid || busy || shareBusy}
              aria-label={t('moa_smart_chat.share')}
              title={t('moa_smart_chat.share')}
            >
              <Icon
                name={shareBusy ? 'spinner' : shareCopied ? 'check' : 'share'}
                size="sm"
                className={shareBusy ? 'animate-spin' : undefined}
              />
              {shareCopied ? (
                <Span className="ml-1 text-xs">{t('moa_smart_chat.copied')}</Span>
              ) : null}
            </Button>
            <Div className="ml-auto flex flex-wrap items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant={showInstructions ? 'danger-outline' : 'primary-outline'}
                onClick={() => setShowInstructions(v => !v)}
                disabled={busy}
                aria-label={t(showInstructions ? 'moa_smart_chat.settings_close' : 'moa_smart_chat.settings_title')}
                title={t(showInstructions ? 'moa_smart_chat.settings_close' : 'moa_smart_chat.settings_title')}
              >
                <Icon name={showInstructions ? 'xmark' : 'sliders'} size="sm" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="primary-outline"
                onClick={handleExport}
                disabled={visibleMessages.length === 0 || busy}
                aria-label={t('moa_smart_chat.export')}
                title={t('moa_smart_chat.export')}
              >
                <Icon name="download" size="sm" />
              </Button>
              <Button type="button" size="sm" variant="primary-outline" className="sm:hidden" onClick={() => void handleNewChat()}>
                <Icon name="plus" size="sm" />
              </Button>
            </Div>
          </Div>

          {branchParentId != null ? (
            <Div className="flex items-center justify-between gap-2 border-b border-amber-400/20 bg-amber-400/10 px-3 py-2">
              <Span className="text-xs text-secondary">{t('moa_smart_chat.branch_active')}</Span>
              <Button type="button" size="sm" variant="primary-outline" onClick={() => setBranchParentId(null)}>
                {t('moa_smart_chat.branch_cancel')}
              </Button>
            </Div>
          ) : null}

          {showInstructions ? (
            <Div className="moa-ai-smart-chat-settings glass-sm-blur space-y-3">
              <Div className="min-w-0">
                <Span className="block text-sm font-medium text-secondary">{t('moa_smart_chat.settings_title')}</Span>
                <Span className="block text-xs text-faint">{t('moa_smart_chat.settings_context_note')}</Span>
              </Div>

              <Div className="glass-sm space-y-2 rounded-xl p-3">
                <Div className="flex items-center gap-1.5">
                  <Icon name="pencil" size="sm" className="text-faint" />
                  <Span className="text-sm text-secondary">{t('moa_smart_chat.instructions')}</Span>
                </Div>
                <Span className="block text-xs text-faint">{t('moa_smart_chat.instructions_hint')}</Span>
                <Textarea
                  value={instructionsDraft}
                  onChange={e => setInstructionsDraft(e.target.value)}
                  rows={3}
                  maxLength={4000}
                  placeholder={t('moa_smart_chat.instructions_placeholder')}
                  className="w-full resize-none text-sm"
                  disabled={instructionsSaving}
                />
                <Div className="flex justify-end gap-2">
                  <Button type="button" size="sm" variant="primary-outline" onClick={() => setShowInstructions(false)}>
                    {t('moa_smart_chat.cancel')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleSaveInstructions()}
                    disabled={instructionsSaving}
                  >
                    {t('moa_smart_chat.save')}
                  </Button>
                </Div>
              </Div>

              <Div className="glass-sm space-y-2 rounded-xl p-3">
                <Div className="flex items-center gap-1.5">
                  <Icon name="star" size="sm" className="text-faint" />
                  <Span className="text-sm text-secondary">{t('moa_smart_chat.memory_title')}</Span>
                  {memories.length > 0 ? (
                    <Span className="ml-auto text-xs text-faint">{memories.length}</Span>
                  ) : null}
                </Div>
                <Span className="block text-xs text-faint">{t('moa_smart_chat.memory_hint')}</Span>
                <Div className="flex gap-1">
                  <input
                    value={memoryDraft}
                    onChange={e => setMemoryDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') void handleAddMemoryDraft();
                    }}
                    placeholder={t('moa_smart_chat.memory_placeholder')}
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-secondary"
                  />
                  <Button type="button" size="sm" variant="secondary" onClick={() => void handleAddMemoryDraft()}>
                    {t('moa_smart_chat.memory_add')}
                  </Button>
                </Div>
                <Div className="max-h-36 space-y-1 overflow-y-auto">
                  {memories.length === 0 ? (
                    <Span className="block px-1 py-0.5 text-xs text-faint">{t('moa_smart_chat.memory_empty')}</Span>
                  ) : (
                    memories.map(m => (
                      <Div key={m.uuid} className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1.5">
                        <Span className="min-w-0 flex-1 text-sm text-secondary">{m.content}</Span>
                        <Button
                          type="button"
                          size="xs"
                          variant="primary-outline"
                          className="shrink-0"
                          onClick={() => void handleDeleteMemory(m.uuid)}
                          aria-label={t('moa_smart_chat.delete')}
                          title={t('moa_smart_chat.delete')}
                        >
                          <Icon name="xmark" size="sm" />
                        </Button>
                      </Div>
                    ))
                  )}
                </Div>
              </Div>

              {activeUuid ? (
                <Div className="glass-sm space-y-2 rounded-xl p-3">
                  <Div className="flex items-center gap-1.5">
                    <Icon name="folder" size="sm" className="text-faint" />
                    <Span className="text-sm text-secondary">{t('moa_smart_chat.move_folder')}</Span>
                  </Div>
                  <Div className="flex flex-wrap gap-1">
                    <Button type="button" size="sm" variant="primary-outline" onClick={() => void handleMoveToFolder(null)}>
                      {t('moa_smart_chat.folder_none')}
                    </Button>
                    {folders.map(f => (
                      <Button
                        key={f.uuid}
                        type="button"
                        size="sm"
                        variant="primary-outline"
                        onClick={() => void handleMoveToFolder(f.uuid)}
                      >
                        {f.name}
                      </Button>
                    ))}
                  </Div>
                </Div>
              ) : null}
            </Div>
          ) : null}

          {/* 대화설정이 열리면 설정 패널이 대화 영역을 대체 — 찌그러진 잔여 대화창 방지 */}
          {!showInstructions ? (
          <Div ref={listRef} className="moa-ai-smart-chat-messages glass-sm-blur space-y-3">
            {loading || messagesLoading || convListLoading ? (
              <AppLoadingSpinner
                fill
                label={t(loading ? 'moa_smart_chat.loading' : 'moa_smart_chat.loading_messages')}
              />
            ) : null}
            {showWelcome ? (
              <Div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <Icon name="comments" className="text-2xl text-faint" />
                <Span className="text-sm text-secondary">{t('moa_smart_chat.welcome')}</Span>
                <Div className="flex max-w-md flex-wrap justify-center gap-2">
                  {QUICK_START_KEYS.map(key => (
                    <Button
                      key={key}
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void handleSend(t(key))}
                    >
                      {t(key)}
                    </Button>
                  ))}
                </Div>
              </Div>
            ) : null}
            {showMessageList ? visibleMessages.map(m => (
              <Div key={`${m.id}-${m.role}`} className="space-y-1">
                <Div
                  className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'ml-auto bg-sky-500/20 text-secondary'
                      : 'mr-auto bg-white/10 text-secondary'
                  }`}
                >
                  {formatMessageBody(m.content)}
                </Div>
                {m.role === 'assistant' && m.id > 0 && !busy ? (
                  <Div className="mr-auto flex flex-wrap gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="dark-outline"
                      className="text-xs"
                      onClick={() => void handleCopyMessage(m.id, m.content)}
                    >
                      <Icon name={copiedMessageId === m.id ? 'check' : 'copy'} size="sm" className="mr-1" />
                      {t(copiedMessageId === m.id ? 'moa_smart_chat.copied' : 'moa_smart_chat.copy')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="dark-outline"
                      className="text-xs"
                      onClick={() => handleBranchFrom(m.id)}
                    >
                      {t('moa_smart_chat.branch_here')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="dark-outline"
                      className="text-xs"
                      onClick={() => void handleHandoff(m)}
                      disabled={handoffId !== null}
                    >
                      {handoffId === m.id ? (
                        <Icon name="spinner" size="sm" className="mr-1 animate-spin" />
                      ) : null}
                      {t(handoffId === m.id
                        ? 'moa_smart_chat.handoff_generating'
                        : 'moa_smart_chat.handoff_create_app')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="dark-outline"
                      className="text-xs"
                      onClick={() => void handleRemember(m.id, m.content)}
                      disabled={rememberedIds.has(m.id) || rememberingId !== null}
                    >
                      {rememberingId === m.id ? (
                        <Icon name="spinner" size="sm" className="mr-1 animate-spin" />
                      ) : rememberedIds.has(m.id) ? (
                        <Icon name="check" size="sm" className="mr-1" />
                      ) : null}
                      {t(rememberedIds.has(m.id) ? 'moa_smart_chat.remembered' : 'moa_smart_chat.remember')}
                    </Button>
                  </Div>
                ) : null}
              </Div>
            )) : null}
            {streamingText ? (
              <Div className="mr-auto max-w-[92%] rounded-2xl bg-white/10 px-3 py-2 text-sm whitespace-pre-wrap text-secondary">
                {streamingText}
                <Span className="moa-ai-smart-chat-caret" aria-hidden="true" />
              </Div>
            ) : null}
            {busy && !streamingText ? (
              <Div className="moa-ai-smart-chat-typing mr-auto max-w-[92%] rounded-2xl bg-white/10 px-3 py-2 text-secondary">
                <Span className="moa-ai-smart-chat-typing__dots" aria-hidden="true">
                  <Span />
                  <Span />
                  <Span />
                </Span>
                <Span className="text-sm text-secondary">
                  {activeToolName
                    ? t(TOOL_STATUS_LABEL_KEYS[activeToolName] ?? 'moa_smart_chat.tool_status_generic')
                    : t('moa_smart_chat.thinking')}
                </Span>
              </Div>
            ) : null}
            {!busy && lastUsedTools.length > 0 ? (
              <Div className="flex flex-wrap items-center gap-1.5">
                <Span className="text-xs text-faint">{t('moa_smart_chat.used_tools_label')}</Span>
                {lastUsedTools.map(name => (
                  <Span key={name} className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-secondary">
                    {t(TOOL_CHIP_LABEL_KEYS[name])}
                  </Span>
                ))}
              </Div>
            ) : null}
            {lastSources.length > 0 ? (
              <Div className="space-y-1 rounded-xl bg-white/5 px-3 py-2">
                <Span className="text-xs text-faint">{t('moa_smart_chat.sources')}</Span>
                {lastSources.map(s => (
                  <a
                    key={s.url}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-xs text-sky-300 hover:underline"
                  >
                    {s.title || s.url}
                  </a>
                ))}
              </Div>
            ) : null}
            {shareInfo?.enabled && (shareInfo.share_url || shareInfo.share_path) ? (
              <Div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                <Div className="min-w-0 flex-1">
                  <Span className="text-xs text-faint">{t('moa_smart_chat.share_link')}</Span>
                  <Span className="block truncate text-xs text-sky-300">
                    {shareInfo.share_url || `${window.location.origin}${shareInfo.share_path}`}
                  </Span>
                </Div>
                <Button type="button" size="sm" variant="primary-outline" onClick={() => void handleCopyShare()}>
                  {t(shareCopied ? 'moa_smart_chat.copied' : 'moa_smart_chat.share_copy')}
                </Button>
              </Div>
            ) : null}
            {lastUsage && (lastUsage.prompt != null || lastUsage.completion != null) ? (
              <Span className="text-xs text-faint">
                {`${t('moa_smart_chat.usage_label')} ${lastUsage.prompt ?? 0} / ${lastUsage.completion ?? 0}`}
              </Span>
            ) : null}
          </Div>
          ) : null}

          {!showInstructions && error ? (
            <Div className="pb-1">
              <Span className="text-xs text-red-400">{error}</Span>
            </Div>
          ) : null}

          {!showInstructions && pendingAttachments.length > 0 ? (
            <Div className="flex flex-wrap gap-2 border-t border-white/5 pt-2">
              {pendingAttachments.map(a => (
                <Div
                  key={a.uuid}
                  className="flex max-w-[200px] items-center gap-2 rounded-xl bg-white/10 px-2 py-1"
                >
                  {a.previewUrl ? (
                    <img src={a.previewUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
                  ) : (
                    <Icon name="file" size="sm" className="text-faint" />
                  )}
                  <Span className="min-w-0 flex-1 truncate text-xs text-secondary">
                    {a.original_name}
                  </Span>
                  <Button
                    type="button"
                    size="sm"
                    variant="primary-outline"
                    className="px-1"
                    onClick={() => removePending(a.uuid)}
                    disabled={busy}
                    aria-label={t('moa_smart_chat.attach_remove')}
                  >
                    <Icon name="xmark" size="sm" />
                  </Button>
                </Div>
              ))}
            </Div>
          ) : null}

          {!showInstructions ? (
          <Div className="moa-ai-smart-chat-composer border-t border-white/10 pt-3">
            <input
              ref={fileInputRef}
              type="file"
              accept={ATTACH_ACCEPT}
              multiple
              className="hidden"
              onChange={e => void handlePickFiles(e.target.files)}
            />
            <Button
              type="button"
              size="medium"
              variant="primary-outline"
              className="moa-ai-smart-chat-composer__attach"
              disabled={busy || uploading || pendingAttachments.length >= MAX_ATTACHMENTS}
              onClick={() => fileInputRef.current?.click()}
              aria-label={t('moa_smart_chat.attach')}
              title={t('moa_smart_chat.attach')}
            >
              <Icon name="paperclip" size="sm" />
            </Button>
            <Textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={draftRows}
              placeholder={t('moa_smart_chat.placeholder')}
              className={`${moaFieldTextareaClass('medium')} moa-ai-smart-chat-composer__input`}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
            />
            {busy ? (
              <Button
                type="button"
                size="medium"
                variant="secondary"
                className="moa-ai-smart-chat-composer__send"
                onClick={handleStop}
              >
                {t('moa_smart_chat.stop')}
              </Button>
            ) : (
              <Button
                type="button"
                size="medium"
                variant="primary"
                className="moa-ai-smart-chat-composer__send"
                onClick={() => void handleSend()}
                disabled={!canSend}
              >
                {t('moa_smart_chat.send')}
              </Button>
            )}
          </Div>
          ) : null}
        </Div>
      </Div>
    </Div>
  );
}
