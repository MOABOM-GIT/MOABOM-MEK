import { useCallback, useEffect, useRef, useState } from 'react';
import type { MoabomTranslateFn } from '../i18n/moabomT';
import {
  fetchChatBlocks,
  fetchChatConversations,
  fetchChatMessages,
  focusChatConversation,
  markChatConversationRead,
  muteChatConversation,
  deleteChatMessage,
  deleteChatConversation,
  signalChatTyping,
  unmuteChatConversation,
  MoabomChatApiError,
  searchChatUsers,
  sendChatMessage,
  startChatConversation,
  unblockChatUser,
  unfocusChatConversation,
  type ChatBlock,
  type ChatConversation,
  type ChatMessage,
  type ChatPeerRead,
  type ChatUserSearchResult,
} from '../api/moabomChatApi';
import { subscribeChatConversation, subscribeChatConversations } from '../runtime/moabomChatSocket';
import { pushInfoToast, pushWarningToast } from '../runtime/moaShellToasts';
import {
  notifyMoabomShellChatBlockChanged,
  subscribeMoabomShellChatBlockChanged,
} from '../shell/moabomShellChatBlockSync';
import { clearMoabomShellActiveChat, setMoabomShellActiveChat } from '../runtime/moabomShellActiveChat';
import {
  consumeMoabomShellPendingChatNavigation,
  peekMoabomShellPendingChatNavigation,
} from '../runtime/moabomShellPendingChatNavigation';
import { getShellAuthUserUuid } from '../utils/presenceSettingsSync';
import { resolveChatReasonToastKey } from '../shell/moabomShellSocialActionToasts';
import { MOABOM_WEBSOCKET_AUTH_SYNCED_EVENT } from '../runtime/moabomWebSocketAuthSync';
import {
  registerShellChatInboxHandler,
} from '../shell/ShellRealtimeStore';
import {
  registerShellChatInboxCacheListener,
  getShellChatInboxCache,
  setShellChatInboxCache,
} from '../shell/moabomShellChatInboxCache';
import {
  isMoabomWebSocketConnected,
  subscribeMoabomWebSocketConnectionChange,
} from '../runtime/moabomWebSocketConnection';
import { requestShellChatInboxSync } from '../runtime/moabomShellChatSyncService';
import { runMoabomShellRealtimeTask } from '../runtime/moabomShellRealtimeRequestCoalescer';
import type { ChatMessageCreatedPayload, ChatReadPayload, ChatTypingPayload } from '../runtime/moabomChatSocket';
import {
  hasChatAutoStartBeenAttempted,
  isChatAutoStartSuppressed,
  markChatAutoStartAttempted,
  suppressChatAutoStartForPeer,
} from '../runtime/moabomShellChatAutoStartGuard';

function chatErrorMessage(error: unknown, t: MoabomTranslateFn): string {
  if (error instanceof MoabomChatApiError) {
    if (error.reason === 'auth_required') {
      return t('moa_chat.toast_login_required');
    }
    if (error.reason) {
      return t(resolveChatReasonToastKey(error.reason));
    }
    return error.message || t('moa_chat.toast_failed');
  }
  return t('moa_chat.toast_failed');
}

function conversationIncludesPeer(
  conversation: ChatConversation | null,
  peerUuid: string,
  selfUuid: string | null,
): boolean {
  if (!conversation) {
    return false;
  }
  return peerUserUuids(conversation, selfUuid).includes(peerUuid);
}

function upsertConversation(list: ChatConversation[], conversation: ChatConversation): ChatConversation[] {
  const next = [conversation, ...list.filter(item => item.uuid !== conversation.uuid)];
  return next.sort((a, b) => (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''));
}

function peerUserUuids(conversation: ChatConversation, selfUuid: string | null): string[] {
  return conversation.members
    .map(member => member.user_uuid)
    .filter(uuid => uuid && uuid !== selfUuid);
}

function syncActiveChat(conversation: ChatConversation | null, selfUuid: string | null): void {
  if (!conversation) {
    clearMoabomShellActiveChat();
    return;
  }
  setMoabomShellActiveChat(conversation.uuid, peerUserUuids(conversation, selfUuid));
}

function appendMessage(list: ChatMessage[], message: ChatMessage): ChatMessage[] {
  if (list.some(item => item.uuid === message.uuid || (message.client_message_id && item.client_message_id === message.client_message_id))) {
    return list.map(item => (item.uuid === message.uuid ? message : item));
  }
  return [...list, message];
}

function peerReadMapFromList(peerRead: ChatPeerRead[] | undefined): Record<string, number> {
  const map: Record<string, number> = {};
  (peerRead ?? []).forEach(row => {
    if (row.user_uuid && row.last_read_message_id != null) {
      map[row.user_uuid] = row.last_read_message_id;
    }
  });
  return map;
}

export function useMoabomChat(
  targetUserUuid: string | undefined,
  t: MoabomTranslateFn,
  initialConversationUuid?: string,
) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [blocks, setBlocks] = useState<ChatBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeConversationRef = useRef<ChatConversation | null>(null);
  const selectSeqRef = useRef(0);
  const pendingNavigationRef = useRef<ReturnType<typeof consumeMoabomShellPendingChatNavigation>>(null);
  const lastConversationTargetRef = useRef<string | null>(null);
  const submitInFlightRef = useRef(false);
  const [wsAuthEpoch, setWsAuthEpoch] = useState(0);
  const [submittingMessage, setSubmittingMessage] = useState(false);
  const [peerReadMap, setPeerReadMap] = useState<Record<string, number>>({});
  const [typingPeerUuids, setTypingPeerUuids] = useState<string[]>([]);
  const typingClearTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastTypingSignalRef = useRef(0);

  const applyIncomingChatMessage = useCallback((payload: ChatMessageCreatedPayload) => {
    const conversationUuid = payload.conversation_uuid
      ?? payload.message?.conversation_uuid
      ?? payload.conversation?.uuid;
    if (!conversationUuid) {
      return;
    }

    const incomingMessage = payload.message
      ?? (payload.conversation?.latest_message as ChatMessage | undefined);
    const active = activeConversationRef.current;
    const isActiveConversation = active?.uuid === conversationUuid;

    if (incomingMessage && isActiveConversation) {
      setMessages(prev => appendMessage(prev, incomingMessage));
      void markChatConversationRead(conversationUuid, incomingMessage.id);
    }

    if (payload.conversation) {
      setConversations(prev => upsertConversation(prev, payload.conversation as ChatConversation));
      setActiveConversation(prev => (
        prev?.uuid === payload.conversation?.uuid ? payload.conversation as ChatConversation : prev
      ));
      return;
    }

    if (incomingMessage) {
      setConversations(prev => prev.map(item => (
        item.uuid === conversationUuid
          ? {
            ...item,
            latest_message: incomingMessage,
            last_message_at: payload.last_message_at ?? incomingMessage.created_at ?? item.last_message_at,
            unread_count: isActiveConversation ? 0 : item.unread_count + 1,
          }
          : item
      )));
    }
  }, []);

  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  const loadConversations = useCallback(async (search?: string, options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const rows = await fetchChatConversations(search);
      setConversations(rows);
      setShellChatInboxCache(rows);
      if (
        !activeConversationRef.current
        && rows[0]
        && !peekMoabomShellPendingChatNavigation()
        && !initialConversationUuid
      ) {
        setActiveConversation(rows[0]);
      }
      return rows;
    } catch (e) {
      const message = chatErrorMessage(e, t);
      if (!silent) {
        setError(message);
      }
      return [];
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [initialConversationUuid, t]);

  const refreshActiveMessagesSilent = useCallback(async () => {
    const active = activeConversationRef.current;
    if (!active) {
      return;
    }
    try {
      const result = await runMoabomShellRealtimeTask(
        `chat:messages:${active.uuid}`,
        () => fetchChatMessages(active.uuid),
        { minIntervalMs: 500 },
      );
      if (activeConversationRef.current?.uuid !== active.uuid) {
        return;
      }
      setMessages(result.messages ?? []);
      setPeerReadMap(peerReadMapFromList(result.peer_read));
    } catch {
      // 폴링·포커스 보조 동기화 — UI 에러는 생략
    }
  }, []);

  const loadBlocks = useCallback(async () => {
    try {
      setBlocks(await fetchChatBlocks());
    } catch {
      setBlocks([]);
    }
  }, []);

  const selectConversation = useCallback(async (conversation: ChatConversation) => {
    const seq = selectSeqRef.current + 1;
    selectSeqRef.current = seq;
    const selfUuid = getShellAuthUserUuid();
    setActiveConversation(conversation);
    syncActiveChat(conversation, selfUuid);
    setMessagesLoading(true);
    setError(null);
    try {
      const result = await fetchChatMessages(conversation.uuid);
      if (selectSeqRef.current !== seq) {
        return;
      }
      setMessages(result.messages ?? []);
      setPeerReadMap(peerReadMapFromList(result.peer_read ?? conversation.peer_read));
      const last = result.messages?.[result.messages.length - 1];
      await Promise.all([
        markChatConversationRead(conversation.uuid, last?.id),
        focusChatConversation(conversation.uuid),
      ]);
      setConversations(prev => prev.map(item => (
        item.uuid === conversation.uuid ? { ...item, unread_count: 0 } : item
      )));
    } catch (e) {
      if (selectSeqRef.current !== seq) {
        return;
      }
      setError(chatErrorMessage(e, t));
    } finally {
      if (selectSeqRef.current === seq) {
        setMessagesLoading(false);
      }
    }
  }, [t]);

  const startWithUsers = useCallback(async (memberUuids: string[], title?: string | null) => {
    try {
      const conversation = await startChatConversation(memberUuids, title);
      setConversations(prev => upsertConversation(prev, conversation));
      await selectConversation(conversation);
      return conversation;
    } catch (e) {
      const message = chatErrorMessage(e, t);
      pushWarningToast(message, 3500);
      setError(message);
      return null;
    }
  }, [selectConversation, t]);

  const applyPendingNavigation = useCallback(async (conversationsList: ChatConversation[]) => {
    const pending = pendingNavigationRef.current;
    if (!pending) {
      return false;
    }

    if (pending.conversationUuid) {
      const match = conversationsList.find(item => item.uuid === pending.conversationUuid);
      if (match) {
        pendingNavigationRef.current = null;
        await selectConversation(match);
        return true;
      }
    }

    if (pending.peerUserUuid) {
      pendingNavigationRef.current = null;
      markChatAutoStartAttempted(pending.peerUserUuid);
      await startWithUsers([pending.peerUserUuid]);
      return true;
    }

    return false;
  }, [selectConversation, startWithUsers]);

  const submitMessage = useCallback(async (body: string) => {
    const trimmed = body.trim();
    if (!trimmed || !activeConversation || submitInFlightRef.current) {
      return false;
    }

    submitInFlightRef.current = true;
    setSubmittingMessage(true);

    const clientMessageId = crypto.randomUUID();
    const selfUuid = getShellAuthUserUuid();
    const selfMember = activeConversation.members.find(member => member.user_uuid === selfUuid);
    const optimisticMessage: ChatMessage = {
      id: -Date.now(),
      uuid: `pending-${clientMessageId}`,
      conversation_uuid: activeConversation.uuid,
      sender: selfMember ?? (selfUuid ? { user_uuid: selfUuid, display_name: '' } : null),
      body: trimmed,
      type: 'text',
      client_message_id: clientMessageId,
      created_at: new Date().toISOString(),
      pending: true,
    };

    setMessages(prev => appendMessage(prev, optimisticMessage));

    try {
      const result = await sendChatMessage(activeConversation.uuid, trimmed, clientMessageId);
      setMessages(prev => appendMessage(
        prev.filter(item => item.client_message_id !== clientMessageId),
        result.message,
      ));
      setConversations(prev => upsertConversation(prev, result.conversation));
      setActiveConversation(result.conversation);
      return true;
    } catch (e) {
      setMessages(prev => prev.filter(item => item.client_message_id !== clientMessageId));
      pushWarningToast(chatErrorMessage(e, t), 3500);
      return false;
    } finally {
      submitInFlightRef.current = false;
      setSubmittingMessage(false);
    }
  }, [activeConversation, t]);

  const unblockUser = useCallback(async (userUuid: string) => {
    const normalized = userUuid.trim();
    if (!normalized) {
      return false;
    }
    try {
      await unblockChatUser(normalized);
      setBlocks(prev => prev.filter(item => item.user_uuid !== normalized));
      notifyMoabomShellChatBlockChanged(normalized, false);
      pushInfoToast(t('moa_profile_actions.chat_unblocked'), 2400);
      return true;
    } catch (e) {
      pushWarningToast(chatErrorMessage(e, t), 3500);
      return false;
    }
  }, [t]);

  const searchUsers = useCallback(async (term: string): Promise<ChatUserSearchResult[]> => {
    if (!term.trim()) {
      return [];
    }
    try {
      return await searchChatUsers(term);
    } catch (e) {
      setError(chatErrorMessage(e, t));
      return [];
    }
  }, [t]);

  const applyPeerReadPayload = useCallback((payload: ChatReadPayload) => {
    const readerUuid = payload.user_uuid?.trim();
    if (!readerUuid || payload.last_read_message_id == null) {
      return;
    }
    setPeerReadMap(prev => ({
      ...prev,
      [readerUuid]: Math.max(prev[readerUuid] ?? 0, payload.last_read_message_id ?? 0),
    }));
  }, []);

  const handlePeerTyping = useCallback((payload: ChatTypingPayload) => {
    const peerUuid = payload.user_uuid?.trim();
    const selfUuid = getShellAuthUserUuid();
    if (!peerUuid || peerUuid === selfUuid) {
      return;
    }
    setTypingPeerUuids(prev => (prev.includes(peerUuid) ? prev : [...prev, peerUuid]));
    if (typingClearTimersRef.current[peerUuid]) {
      clearTimeout(typingClearTimersRef.current[peerUuid]);
    }
    typingClearTimersRef.current[peerUuid] = setTimeout(() => {
      setTypingPeerUuids(prev => prev.filter(uuid => uuid !== peerUuid));
      delete typingClearTimersRef.current[peerUuid];
    }, 3500);
  }, []);

  const signalTyping = useCallback(() => {
    const conversation = activeConversationRef.current;
    if (!conversation) {
      return;
    }
    const now = Date.now();
    if (now - lastTypingSignalRef.current < 2000) {
      return;
    }
    lastTypingSignalRef.current = now;
    void signalChatTyping(conversation.uuid).catch(() => undefined);
  }, []);

  const isMessageReadByPeer = useCallback((message: ChatMessage): boolean => {
    if (!message.id || message.id < 0 || message.pending) {
      return false;
    }
    const peerIds = Object.values(peerReadMap);
    if (peerIds.length === 0) {
      return false;
    }
    return peerIds.some(readId => readId >= message.id);
  }, [peerReadMap]);

  const toggleConversationMute = useCallback(async () => {
    const conversation = activeConversationRef.current;
    if (!conversation) {
      return;
    }
    try {
      if (conversation.is_muted) {
        await unmuteChatConversation(conversation.uuid);
        setConversations(prev => prev.map(item => (
          item.uuid === conversation.uuid ? { ...item, is_muted: false, muted_until: null } : item
        )));
        setActiveConversation(prev => (
          prev?.uuid === conversation.uuid ? { ...prev, is_muted: false, muted_until: null } : prev
        ));
        pushInfoToast(t('moa_chat.mute_off'), 2400);
      } else {
        await muteChatConversation(conversation.uuid);
        setConversations(prev => prev.map(item => (
          item.uuid === conversation.uuid ? { ...item, is_muted: true } : item
        )));
        setActiveConversation(prev => (
          prev?.uuid === conversation.uuid ? { ...prev, is_muted: true } : prev
        ));
        pushInfoToast(t('moa_chat.mute_on'), 2400);
      }
    } catch (e) {
      pushWarningToast(chatErrorMessage(e, t), 3200);
    }
  }, [t]);

  const removeOwnMessage = useCallback(async (messageUuid: string) => {
    try {
      await deleteChatMessage(messageUuid);
      setMessages(prev => prev.filter(item => item.uuid !== messageUuid));
    } catch (e) {
      pushWarningToast(chatErrorMessage(e, t), 3200);
    }
  }, [t]);

  const removeConversation = useCallback(async (conversationUuid: string) => {
    try {
      await deleteChatConversation(conversationUuid);
      const wasActive = activeConversationRef.current?.uuid === conversationUuid;

      if (wasActive) {
        void unfocusChatConversation(conversationUuid).catch(() => undefined);
        setMessages([]);
        clearMoabomShellActiveChat();
      }

      const selfUuid = getShellAuthUserUuid();
      let nextActive: ChatConversation | null = null;
      setConversations(prev => {
        const removed = prev.find(item => item.uuid === conversationUuid);
        if (removed) {
          peerUserUuids(removed, selfUuid).forEach(peerUuid => suppressChatAutoStartForPeer(peerUuid));
        }
        const next = prev.filter(item => item.uuid !== conversationUuid);
        setShellChatInboxCache(next);
        if (wasActive) {
          nextActive = next[0] ?? null;
        }
        return next;
      });

      if (wasActive) {
        if (nextActive) {
          void selectConversation(nextActive);
        } else {
          setActiveConversation(null);
        }
      }

      pushInfoToast(t('moa_chat.toast_conversation_removed'), 2400);
    } catch (e) {
      pushWarningToast(chatErrorMessage(e, t), 3200);
    }
  }, [selectConversation, t]);

  useEffect(() => {
    const cached = getShellChatInboxCache();
    if (cached.length > 0) {
      setConversations(cached);
    }
    void loadConversations(undefined, { silent: cached.length > 0 });
    void loadBlocks();
  }, [loadBlocks, loadConversations]);

  useEffect(() => {
    const refreshOnFocus = () => {
      void loadBlocks();
      requestShellChatInboxSync();
      void refreshActiveMessagesSilent();
    };
    const onFocus = () => {
      refreshOnFocus();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshOnFocus();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [loadBlocks, refreshActiveMessagesSilent]);

  useEffect(() => {
    const onWsAuthSynced = () => {
      setWsAuthEpoch(epoch => epoch + 1);
    };
    window.addEventListener(MOABOM_WEBSOCKET_AUTH_SYNCED_EVENT, onWsAuthSynced);
    return () => window.removeEventListener(MOABOM_WEBSOCKET_AUTH_SYNCED_EVENT, onWsAuthSynced);
  }, []);

  useEffect(() => {
    return subscribeMoabomWebSocketConnectionChange(() => {
      if (isMoabomWebSocketConnected()) {
        void refreshActiveMessagesSilent();
      }
    });
  }, [refreshActiveMessagesSilent]);

  useEffect(() => {
    if (conversations.length === 0) {
      return;
    }

    const pending = consumeMoabomShellPendingChatNavigation();
    if (pending) {
      pendingNavigationRef.current = pending;
      void applyPendingNavigation(conversations);
      return;
    }

    if (!initialConversationUuid || lastConversationTargetRef.current === initialConversationUuid) {
      return;
    }

    const match = conversations.find(item => item.uuid === initialConversationUuid);
    if (!match) {
      return;
    }

    lastConversationTargetRef.current = initialConversationUuid;
    void selectConversation(match);
  }, [applyPendingNavigation, conversations, initialConversationUuid, selectConversation]);

  useEffect(() => {
    if (!targetUserUuid || getShellAuthUserUuid() === targetUserUuid) {
      return;
    }
    if (loading) {
      return;
    }
    if (isChatAutoStartSuppressed(targetUserUuid)) {
      return;
    }
    if (pendingNavigationRef.current || initialConversationUuid) {
      return;
    }
    if (peekMoabomShellPendingChatNavigation()) {
      return;
    }
    if (blocks.some(block => block.user_uuid === targetUserUuid)) {
      setError(t('moa_chat.toast_blocked_by_self'));
      return;
    }

    const selfUuid = getShellAuthUserUuid();
    const existing = conversations.find(conversation => (
      conversationIncludesPeer(conversation, targetUserUuid, selfUuid)
    ));
    if (existing) {
      markChatAutoStartAttempted(targetUserUuid);
      if (!activeConversationRef.current) {
        void selectConversation(existing);
      }
      return;
    }

    if (hasChatAutoStartBeenAttempted(targetUserUuid)) {
      return;
    }

    markChatAutoStartAttempted(targetUserUuid);
    void startWithUsers([targetUserUuid]);
  }, [blocks, conversations, initialConversationUuid, loading, selectConversation, startWithUsers, targetUserUuid, t]);

  useEffect(() => {
    return subscribeMoabomShellChatBlockChanged(detail => {
      if (detail.blocked) {
        void loadBlocks();
        const selfUuid = getShellAuthUserUuid();
        if (targetUserUuid === detail.userUuid) {
          setError(t('moa_chat.toast_blocked_by_self'));
        }
        const active = activeConversationRef.current;
        if (conversationIncludesPeer(active, detail.userUuid, selfUuid)) {
          if (active) {
            void unfocusChatConversation(active.uuid).catch(() => undefined);
          }
          setActiveConversation(null);
          setMessages([]);
          clearMoabomShellActiveChat();
          setError(t('moa_chat.toast_blocked_by_self'));
        }
        return;
      }
      setBlocks(prev => prev.filter(item => item.user_uuid !== detail.userUuid));
      if (targetUserUuid === detail.userUuid) {
        setError(null);
        void startWithUsers([detail.userUuid]);
      }
    });
  }, [loadBlocks, startWithUsers, t, targetUserUuid]);

  useEffect(() => () => {
    const active = activeConversationRef.current;
    if (active) {
      void unfocusChatConversation(active.uuid).catch(() => undefined);
    }
    clearMoabomShellActiveChat();
  }, []);

  useEffect(() => {
    return registerShellChatInboxCacheListener(cached => {
      setConversations(cached);
    });
  }, []);

  useEffect(() => {
    return registerShellChatInboxHandler(applyIncomingChatMessage);
  }, [applyIncomingChatMessage]);

  useEffect(() => {
    const channels = conversations
      .map(conversation => conversation.channel)
      .filter((channel): channel is string => Boolean(channel));

    if (channels.length === 0) {
      return undefined;
    }

    const subscription = subscribeChatConversations(channels, {
      onMessageCreated: applyIncomingChatMessage,
      onTyping: handlePeerTyping,
      onMessageDeleted: payload => {
        if (!payload.message_uuid) {
          return;
        }
        setMessages(prev => prev.filter(item => item.uuid !== payload.message_uuid));
      },
    });

    if (!subscription) {
      return undefined;
    }

    return () => subscription.unsubscribe();
  }, [applyIncomingChatMessage, conversations, handlePeerTyping, wsAuthEpoch]);

  useEffect(() => {
    if (!activeConversation?.channel) {
      return undefined;
    }
    const selfUuid = getShellAuthUserUuid();
    const subscription = subscribeChatConversation(activeConversation.channel, {
      onMessageCreated: applyIncomingChatMessage,
      onTyping: handlePeerTyping,
      onMessageDeleted: payload => {
        if (!payload.message_uuid) {
          return;
        }
        setMessages(prev => prev.filter(item => item.uuid !== payload.message_uuid));
      },
      onRead: payload => {
        if (payload.conversation_uuid === activeConversation.uuid && payload.user_uuid && payload.user_uuid !== selfUuid) {
          applyPeerReadPayload(payload);
          return;
        }
        if (payload.conversation_uuid === activeConversation.uuid && payload.user_uuid === selfUuid) {
          setConversations(prev => prev.map(item => (
            item.uuid === activeConversation.uuid ? { ...item, unread_count: 0 } : item
          )));
        }
      },
    });

    return () => subscription?.unsubscribe();
  }, [activeConversation?.channel, activeConversation?.uuid, applyIncomingChatMessage, applyPeerReadPayload, handlePeerTyping, wsAuthEpoch]);

  return {
    conversations,
    activeConversation,
    messages,
    blocks,
    loading,
    messagesLoading,
    error,
    loadConversations,
    loadBlocks,
    selectConversation,
    startWithUsers,
    submitMessage,
    submittingMessage,
    signalTyping,
    isMessageReadByPeer,
    isPeerTyping: typingPeerUuids.length > 0,
    toggleConversationMute,
    removeOwnMessage,
    removeConversation,
    searchUsers,
    unblockUser,
  };
}
