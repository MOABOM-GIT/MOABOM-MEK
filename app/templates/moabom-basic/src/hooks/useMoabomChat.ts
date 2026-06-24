import { useCallback, useEffect, useRef, useState } from 'react';
import type { MoabomTranslateFn } from '../i18n/moabomT';
import {
  fetchChatBlocks,
  fetchChatConversations,
  fetchChatMessages,
  focusChatConversation,
  markChatConversationRead,
  MoabomChatApiError,
  searchChatUsers,
  sendChatMessage,
  startChatConversation,
  unblockChatUser,
  unfocusChatConversation,
  type ChatBlock,
  type ChatConversation,
  type ChatMessage,
  type ChatUserSearchResult,
} from '../api/moabomChatApi';
import { subscribeChatConversation } from '../runtime/moabomChatSocket';
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
  const startedTargetRef = useRef<string | null>(null);
  const activeConversationRef = useRef<ChatConversation | null>(null);
  const selectSeqRef = useRef(0);
  const pendingNavigationRef = useRef<ReturnType<typeof consumeMoabomShellPendingChatNavigation>>(null);
  const lastConversationTargetRef = useRef<string | null>(null);

  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  const loadConversations = useCallback(async (search?: string) => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchChatConversations(search);
      setConversations(rows);
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
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [initialConversationUuid, t]);

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
      startedTargetRef.current = pending.peerUserUuid;
      await startWithUsers([pending.peerUserUuid]);
      return true;
    }

    return false;
  }, [selectConversation, startWithUsers]);

  const submitMessage = useCallback(async (body: string) => {
    const trimmed = body.trim();
    if (!trimmed || !activeConversation) {
      return false;
    }
    try {
      const result = await sendChatMessage(activeConversation.uuid, trimmed);
      setMessages(prev => appendMessage(prev, result.message));
      setConversations(prev => upsertConversation(prev, result.conversation));
      setActiveConversation(result.conversation);
      return true;
    } catch (e) {
      pushWarningToast(chatErrorMessage(e, t), 3500);
      return false;
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

  useEffect(() => {
    void loadConversations();
    void loadBlocks();
  }, [loadBlocks, loadConversations]);

  useEffect(() => {
    const onFocus = () => {
      void loadBlocks();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadBlocks]);

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
    if (!targetUserUuid || startedTargetRef.current === targetUserUuid || getShellAuthUserUuid() === targetUserUuid) {
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
    startedTargetRef.current = targetUserUuid;
    void startWithUsers([targetUserUuid]);
  }, [blocks, initialConversationUuid, startWithUsers, targetUserUuid]);

  useEffect(() => {
    return subscribeMoabomShellChatBlockChanged(detail => {
      if (detail.blocked) {
        void loadBlocks();
        const selfUuid = getShellAuthUserUuid();
        if (targetUserUuid === detail.userUuid) {
          startedTargetRef.current = detail.userUuid;
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
        startedTargetRef.current = null;
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
    if (!activeConversation?.channel) {
      return undefined;
    }
    const subscription = subscribeChatConversation(activeConversation.channel, {
      onMessageCreated: payload => {
        const message = payload.message as ChatMessage | undefined;
        const conversationUuid = payload.conversation_uuid ?? message?.conversation_uuid ?? activeConversation.uuid;
        if (message && conversationUuid === activeConversation.uuid) {
          setMessages(prev => appendMessage(prev, message));
          void markChatConversationRead(activeConversation.uuid, message.id);
        }
        if (payload.conversation) {
          setConversations(prev => upsertConversation(prev, payload.conversation as ChatConversation));
          setActiveConversation(prev => (prev?.uuid === payload.conversation?.uuid ? payload.conversation as ChatConversation : prev));
        } else if (message) {
          setConversations(prev => prev.map(item => (
            item.uuid === conversationUuid
              ? {
                ...item,
                latest_message: message,
                last_message_at: payload.last_message_at ?? message.created_at ?? item.last_message_at,
                unread_count: conversationUuid === activeConversation.uuid ? 0 : item.unread_count + 1,
              }
              : item
          )));
        }
      },
      onRead: payload => {
        if (payload.conversation_uuid === activeConversation.uuid && payload.user_uuid === getShellAuthUserUuid()) {
          setConversations(prev => prev.map(item => (
            item.uuid === activeConversation.uuid ? { ...item, unread_count: 0 } : item
          )));
        }
      },
    });

    return () => subscription?.unsubscribe();
  }, [activeConversation?.channel, activeConversation?.uuid]);

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
    searchUsers,
    unblockUser,
  };
}
