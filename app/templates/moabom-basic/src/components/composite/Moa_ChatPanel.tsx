import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatConversation, ChatMember, ChatUserSearchResult } from '../../api/moabomChatApi';
import { useMoabomShellT } from '../../i18n/MoabomUiI18nProvider';
import { useMoabomChat } from '../../hooks/useMoabomChat';
import { useMoaAppWindowNarrow } from '../../hooks/useMoaAppWindowNarrow';
import { openMoabomUserProfile } from '../../shell/openMoabomUserProfile';
import {
  chatMemberNickname,
  chatMemberRealName,
  shouldShowChatMemberRealName,
} from '../../utils/chatMemberDisplay';
import { Button } from '../basic/Button';
import { Div } from '../basic/Div';
import { Icon } from '../basic/Icon';
import { Input } from '../basic/Input';
import { Span } from '../basic/Span';
import { Textarea } from '../basic/Textarea';
import AppLoadingSpinner from './AppLoadingSpinner';
import { getShellAuthUserUuid } from '../../utils/presenceSettingsSync';

const ChatMuteToggleIndicator: React.FC<{ active: boolean }> = ({ active }) => (
  <Span
    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${active ? '' : 'bg-slate-300 dark:bg-slate-600'}`}
    style={active ? { background: 'var(--moa-point-color)' } : undefined}
    aria-hidden
  >
    <Span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-[left] ${active ? 'left-[1.125rem]' : 'left-0.5'}`} />
  </Span>
);

function ChatProfileNicknameButton({
  userUuid,
  displayName,
  className = '',
}: {
  userUuid?: string | null;
  displayName: string;
  className?: string;
}) {
  if (!userUuid) {
    return <Span className={className}>{displayName}</Span>;
  }
  return (
    <Span
      role="button"
      tabIndex={0}
      className={`cursor-pointer underline-offset-2 hover:underline ${className}`}
      onClick={event => {
        event.stopPropagation();
        openMoabomUserProfile(userUuid);
      }}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          openMoabomUserProfile(userUuid);
        }
      }}
    >
      {displayName}
    </Span>
  );
}

export interface MoaChatPanelProps {
  targetUserUuid?: string;
  initialConversationUuid?: string;
}

export const Moa_ChatPanel: React.FC<MoaChatPanelProps> = ({
  targetUserUuid,
  initialConversationUuid,
}) => {
  const { t } = useMoabomShellT();
  const chat = useMoabomChat(targetUserUuid, t, initialConversationUuid);
  const [search, setSearch] = useState('');
  const [userResults, setUserResults] = useState<ChatUserSearchResult[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<ChatUserSearchResult[]>([]);
  const [message, setMessage] = useState('');
  const [showBlocks, setShowBlocks] = useState(false);
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [unblockingUuid, setUnblockingUuid] = useState<string | null>(null);
  const [deletingConversationUuid, setDeletingConversationUuid] = useState<string | null>(null);
  const { narrow: isNarrow, containerRef: panelRef } = useMoaAppWindowNarrow();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const currentUserUuid = getShellAuthUserUuid();

  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) {
      setUserResults([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      void chat.searchUsers(term).then(setUserResults);
    }, 240);
    return () => clearTimeout(timer);
  }, [chat.searchUsers, search]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [chat.messages, chat.messagesLoading]);

  const addSelectedUser = useCallback((user: ChatUserSearchResult) => {
    if (!user.eligibility.can_chat) {
      return;
    }
    setSelectedUsers(prev => (
      prev.some(item => item.user_uuid === user.user_uuid) ? prev : [...prev, user]
    ));
  }, []);

  const startSelectedConversation = useCallback(async () => {
    if (selectedUsers.length === 0) {
      return;
    }
    const conversation = await chat.startWithUsers(selectedUsers.map(user => user.user_uuid));
    if (conversation) {
      setSelectedUsers([]);
      setSearch('');
      setUserResults([]);
    }
  }, [chat.startWithUsers, selectedUsers]);

  const submit = useCallback(async () => {
    if (chat.submittingMessage) {
      return;
    }
    const body = message;
    const ok = await chat.submitMessage(body);
    if (ok) {
      setMessage('');
    }
  }, [chat.submitMessage, chat.submittingMessage, message]);

  const handleUnblock = useCallback(async (userUuid: string) => {
    setUnblockingUuid(userUuid);
    try {
      await chat.unblockUser(userUuid);
    } finally {
      setUnblockingUuid(current => (current === userUuid ? null : current));
    }
  }, [chat.unblockUser]);

  const handleRemoveConversation = useCallback(async (conversationUuid: string) => {
    setDeletingConversationUuid(conversationUuid);
    try {
      await chat.removeConversation(conversationUuid);
    } finally {
      setDeletingConversationUuid(current => (current === conversationUuid ? null : current));
    }
  }, [chat.removeConversation]);

  const selectConversation = useCallback((conversation: ChatConversation) => {
    void chat.selectConversation(conversation);
    if (isNarrow) {
      setMobileListOpen(false);
    }
  }, [chat.selectConversation, isNarrow]);

  useEffect(() => {
    if (!isNarrow) {
      setMobileListOpen(false);
    }
  }, [isNarrow]);

  const peerMembers = useCallback((members: ChatMember[] = []) => (
    members.filter(member => member.user_uuid && member.user_uuid !== currentUserUuid)
  ), [currentUserUuid]);

  const activePeerMembers = useMemo(
    () => peerMembers(chat.activeConversation?.members ?? []),
    [chat.activeConversation?.members, peerMembers],
  );

  const headerNickname = useMemo(() => {
    if (activePeerMembers.length === 1) {
      return chatMemberNickname(activePeerMembers[0]);
    }
    return chat.activeConversation?.display_title ?? t('moa_chat.no_conversation');
  }, [activePeerMembers, chat.activeConversation?.display_title, t]);

  const headerRealNames = useMemo(() => (
    activePeerMembers
      .filter(shouldShowChatMemberRealName)
      .map(member => chatMemberRealName(member))
  ), [activePeerMembers]);

  const panelClassName = [
    'moa-chat-panel',
    'rounded-lg',
    'glass-panel',
    isNarrow && mobileListOpen ? 'moa-chat-panel--mobile-list' : '',
  ].filter(Boolean).join(' ');

  return (
    <Div ref={panelRef} className={panelClassName}>
      <Div className="moa-chat-sidebar moa-group">
        <Div className="moa-chat-sidebar__header">
          {isNarrow && mobileListOpen ? (
            <Button
              type="button"
              variant="dark-outline"
              size="xs"
              className="moa-chat-sidebar__back-btn"
              aria-label={t('moa_chat.back_to_chat')}
              onClick={() => setMobileListOpen(false)}
            >
              <Icon name="arrow-left" className="text-sm" aria-hidden />
            </Button>
          ) : null}
          <Span className="moa-chat-sidebar__title">{t('moa_chat.title')}</Span>
          <Button type="button" variant="dark-outline" size="xs" onClick={() => setShowBlocks(value => !value)}>
            {t('moa_chat.blocks')}
          </Button>
        </Div>

        <Input
          value={search}
          placeholder={t('moa_chat.search_placeholder')}
          className="moa-chat-sidebar__search"
          onChange={event => setSearch(event.target.value)}
        />

        {selectedUsers.length > 0 ? (
          <Div className="moa-chat-sidebar__selection glass-panel rounded-xl border border-gray-200 p-2 dark:border-gray-700">
            <Div className="mb-2 flex flex-wrap gap-1">
              {selectedUsers.map(user => (
                <Div
                  key={user.user_uuid}
                  className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-2 py-1 text-sm dark:border-gray-700"
                >
                  <ChatProfileNicknameButton
                    userUuid={user.user_uuid}
                    displayName={user.display_name}
                  />
                  <Button
                    type="button"
                    variant="dark-outline"
                    size="xxs"
                    className="rounded-lg border-0 px-1"
                    aria-label={t('moa_chat.remove_selected')}
                    onClick={() => setSelectedUsers(prev => prev.filter(item => item.user_uuid !== user.user_uuid))}
                  >
                    x
                  </Button>
                </Div>
              ))}
            </Div>
            <Button type="button" variant="primary" size="sm" className="w-full" onClick={startSelectedConversation}>
              {selectedUsers.length > 1 ? t('moa_chat.start_group') : t('moa_chat.start_direct')}
            </Button>
          </Div>
        ) : null}

        {userResults.length > 0 ? (
          <Div className="moa-chat-sidebar__search-results glass-panel">
            {userResults.map(user => (
              <Div
                key={user.user_uuid}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700/70"
              >
                <ChatProfileNicknameButton
                  userUuid={user.user_uuid}
                  displayName={user.display_name}
                  className="min-w-0 flex-1 truncate text-left text-sm"
                />
                <Button
                  type="button"
                  variant="dark-outline"
                  size="xs"
                  className="shrink-0 rounded-lg"
                  disabled={!user.eligibility.can_chat}
                  onClick={() => addSelectedUser(user)}
                >
                  {user.eligibility.can_chat ? t('moa_chat.add') : t('moa_chat.rejected_short')}
                </Button>
              </Div>
            ))}
          </Div>
        ) : null}

        {showBlocks ? (
          <Div className="moa-chat-sidebar__blocks glass-panel rounded-xl border border-gray-200 p-2 dark:border-gray-700">
            <Div className="mb-2 text-xs font-semibold text-muted">{t('moa_chat.blocks')}</Div>
            {chat.blocks.length === 0 ? (
              <Span className="text-xs text-muted">{t('moa_chat.blocks_empty')}</Span>
            ) : chat.blocks.map(block => (
              <Div key={block.user_uuid} className="flex items-center gap-2 py-1">
                <ChatProfileNicknameButton
                  userUuid={block.user_uuid}
                  displayName={block.display_name}
                  className="min-w-0 flex-1 truncate text-left text-sm text-secondary"
                />
                <Button
                  type="button"
                  variant="danger-outline"
                  size="xs"
                  className="shrink-0 rounded-lg"
                  disabled={unblockingUuid === block.user_uuid}
                  onClick={() => void handleUnblock(block.user_uuid)}
                >
                  {t('moa_chat.unblock')}
                </Button>
              </Div>
            ))}
          </Div>
        ) : null}

        <Div className="moa-chat-conversation-list">
          {chat.loading ? (
            <AppLoadingSpinner label={t('moa_chat.loading')} />
          ) : chat.conversations.length === 0 ? (
            <Div className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-muted dark:border-gray-700">
              {t('moa_chat.empty')}
            </Div>
          ) : chat.conversations.map(conversation => {
            const isActive = chat.activeConversation?.uuid === conversation.uuid;
            const conversationPeers = peerMembers(conversation.members);
            const singlePeer = conversationPeers.length === 1 ? conversationPeers[0] : null;
            return (
              <Div
                key={conversation.uuid}
                role="button"
                tabIndex={0}
                className={`moa-chat-conversation-item glass-panel${isActive ? ' moa-chat-conversation-item--active' : ''}`}
                onClick={() => selectConversation(conversation)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    selectConversation(conversation);
                  }
                }}
              >
                <Span className="moa-chat-conversation-item__title-row">
                  <Span className="moa-chat-conversation-item__title">
                    {singlePeer ? (
                      <ChatProfileNicknameButton
                        userUuid={singlePeer.user_uuid}
                        displayName={conversation.display_title}
                        className="font-inherit"
                      />
                    ) : conversation.display_title}
                  </Span>
                  <Span className="moa-chat-conversation-item__meta">
                    {conversation.unread_count > 0 ? (
                      <Span className="moa-chat-unread-badge">{conversation.unread_count}</Span>
                    ) : null}
                    <Button
                      type="button"
                      variant="dark-outline"
                      size="xxs"
                      className="moa-chat-conversation-item__delete shrink-0 rounded-lg border-0 px-1.5"
                      aria-label={t('moa_chat.delete_conversation')}
                      disabled={deletingConversationUuid === conversation.uuid}
                      onClick={event => {
                        event.stopPropagation();
                        void handleRemoveConversation(conversation.uuid);
                      }}
                    >
                      <Icon name="trash" className="text-xs" aria-hidden />
                    </Button>
                  </Span>
                </Span>
                <Span className="moa-chat-conversation-item__preview">
                  {conversation.latest_message?.body ?? t('moa_chat.no_messages')}
                </Span>
              </Div>
            );
          })}
        </Div>
      </Div>

      <Div className="moa-chat-main">
        <Div className="moa-chat-header">
          <Div className="moa-chat-header__lead">
            <Div className="moa-chat-header__title">
              {activePeerMembers.length === 1 ? (
                <ChatProfileNicknameButton
                  userUuid={activePeerMembers[0]?.user_uuid}
                  displayName={headerNickname}
                  className="text-base font-semibold"
                />
              ) : (
                headerNickname
              )}
            </Div>
            {headerRealNames.length > 0 ? (
              <Div className="moa-chat-header__members">
                {activePeerMembers
                  .filter(shouldShowChatMemberRealName)
                  .map((member, index) => (
                    <Span key={member.user_uuid}>
                      {index > 0 ? ', ' : null}
                      <ChatProfileNicknameButton
                        userUuid={member.user_uuid}
                        displayName={chatMemberRealName(member)}
                        className="text-sm text-muted"
                      />
                    </Span>
                  ))}
              </Div>
            ) : null}
          </Div>
          <Div className="moa-chat-header__actions flex items-center gap-2">
            {chat.activeConversation ? (
              <Button
                type="button"
                variant="dark-outline"
                size="xs"
                className="moa-chat-header__mute-toggle shrink-0"
                style={{ justifyContent: 'space-between', gap: '0.5rem' }}
                aria-pressed={!chat.activeConversation.is_muted}
                onClick={() => void chat.toggleConversationMute()}
              >
                <Span className="whitespace-nowrap">
                  {chat.activeConversation.is_muted
                    ? t('moa_chat.mute_toggle_on')
                    : t('moa_chat.mute_toggle_off')}
                </Span>
                <ChatMuteToggleIndicator active={!chat.activeConversation.is_muted} />
              </Button>
            ) : null}
            {isNarrow ? (
              <Button
                type="button"
                variant="dark-outline"
                size="xs"
                className="moa-chat-header__list-btn shrink-0"
                onClick={() => setMobileListOpen(true)}
              >
                {t('moa_chat.conversation_list')}
              </Button>
            ) : null}
          </Div>
        </Div>

        <Div className="moa-chat-messages">
          {chat.messagesLoading ? (
            <AppLoadingSpinner label={t('moa_chat.messages_loading')} fill />
          ) : chat.messages.length === 0 ? (
            <Div className="moa-chat-messages__empty">
              {chat.activeConversation
                ? t('moa_chat.messages_empty')
                : (isNarrow ? t('moa_chat.choose_conversation_mobile') : t('moa_chat.choose_conversation'))}
            </Div>
          ) : (
            <Div className="moa-chat-message-list">
              {chat.isPeerTyping ? (
                <Div className="moa-chat-typing-hint text-xs text-muted px-2 py-1">{t('moa_chat.typing')}</Div>
              ) : null}
              {chat.messages.map((item, index) => {
                const isOwn = item.sender?.user_uuid && item.sender.user_uuid === currentUserUuid;
                const isLastOwn = isOwn
                  && !item.pending
                  && index === chat.messages.length - 1
                  && chat.isMessageReadByPeer(item);
                return (
                  <Div
                    key={item.uuid}
                    className={`moa-chat-bubble glass-panel ${isOwn ? 'moa-chat-bubble--own' : 'moa-chat-bubble--other'}${item.pending ? ' moa-chat-bubble--pending' : ''}`}
                  >
                    <Div className="moa-chat-bubble__sender">
                      <ChatProfileNicknameButton
                        userUuid={item.sender?.user_uuid}
                        displayName={item.sender?.display_name ?? t('moa_chat.unknown_sender')}
                        className="text-xs font-medium text-muted"
                      />
                    </Div>
                    <Div className="moa-chat-bubble__body">{item.body}</Div>
                    {isLastOwn ? (
                      <Div className="moa-chat-bubble__meta text-[11px] text-muted text-right">{t('moa_chat.read_badge')}</Div>
                    ) : null}
                    {isOwn && !item.pending && item.uuid && !item.uuid.startsWith('pending-') ? (
                      <Button
                        type="button"
                        variant="dark-outline"
                        size="xs"
                        className="moa-chat-bubble__delete mt-1"
                        onClick={() => void chat.removeOwnMessage(item.uuid)}
                      >
                        {t('moa_chat.delete_message')}
                      </Button>
                    ) : null}
                  </Div>
                );
              })}
              <Div ref={bottomRef} />
            </Div>
          )}
        </Div>

        <Div className="moa-chat-composer">
          {chat.error ? <Div className="moa-chat-composer__error">{chat.error}</Div> : null}
          <Div className="moa-chat-composer__row">
            <Textarea
              value={message}
              placeholder={t('moa_chat.message_placeholder')}
              className="moa-chat-composer__input"
              rows={1}
              disabled={!chat.activeConversation}
              onChange={event => {
                setMessage(event.target.value);
                chat.signalTyping();
              }}
            />
            <Button
              type="button"
              variant="primary"
              className="moa-chat-composer__send"
              disabled={!chat.activeConversation || !message.trim() || chat.submittingMessage}
              onClick={() => void submit()}
            >
              {t('moa_chat.send')}
            </Button>
          </Div>
        </Div>
      </Div>
    </Div>
  );
};
