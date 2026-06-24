import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMember, ChatUserSearchResult } from '../../api/moabomChatApi';
import { useMoabomShellT } from '../../i18n/MoabomUiI18nProvider';
import { useMoabomChat } from '../../hooks/useMoabomChat';
import { openMoabomUserProfile } from '../../shell/openMoabomUserProfile';
import { Button } from '../basic/Button';
import { Div } from '../basic/Div';
import { Input } from '../basic/Input';
import { Span } from '../basic/Span';
import { Textarea } from '../basic/Textarea';
import AppLoadingSpinner from './AppLoadingSpinner';
import { getShellAuthUserUuid } from '../../utils/presenceSettingsSync';

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
  const [unblockingUuid, setUnblockingUuid] = useState<string | null>(null);
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
    const ok = await chat.submitMessage(message);
    if (ok) {
      setMessage('');
    }
  }, [chat.submitMessage, message]);

  const handleUnblock = useCallback(async (userUuid: string) => {
    setUnblockingUuid(userUuid);
    try {
      await chat.unblockUser(userUuid);
    } finally {
      setUnblockingUuid(current => (current === userUuid ? null : current));
    }
  }, [chat.unblockUser]);

  const peerMembers = useCallback((members: ChatMember[] = []) => (
    members.filter(member => member.user_uuid && member.user_uuid !== currentUserUuid)
  ), [currentUserUuid]);

  const activePeerMembers = useMemo(
    () => peerMembers(chat.activeConversation?.members ?? []),
    [chat.activeConversation?.members, peerMembers],
  );

  const activeMembers = useMemo(() => (
    activePeerMembers.length > 0
      ? activePeerMembers.map(member => member.display_name).join(', ')
      : t('moa_chat.no_conversation')
  ), [activePeerMembers, t]);

  return (
    <Div className="moa-chat-panel rounded-lg glass-panel">
      <Div className="moa-chat-sidebar">
        <Div className="moa-chat-sidebar__header">
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
                onClick={() => void chat.selectConversation(conversation)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    void chat.selectConversation(conversation);
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
                  {conversation.unread_count > 0 ? (
                    <Span className="moa-chat-unread-badge">{conversation.unread_count}</Span>
                  ) : null}
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
          <Div className="moa-chat-header__title">
            {activePeerMembers.length === 1 ? (
              <ChatProfileNicknameButton
                userUuid={activePeerMembers[0]?.user_uuid}
                displayName={chat.activeConversation?.display_title ?? t('moa_chat.no_conversation')}
                className="text-base font-semibold"
              />
            ) : (
              chat.activeConversation?.display_title ?? t('moa_chat.no_conversation')
            )}
          </Div>
          <Div className="moa-chat-header__members">
            {activePeerMembers.length > 0 ? (
              activePeerMembers.map((member, index) => (
                <Span key={member.user_uuid}>
                  {index > 0 ? ', ' : null}
                  <ChatProfileNicknameButton
                    userUuid={member.user_uuid}
                    displayName={member.display_name}
                    className="text-sm text-muted"
                  />
                </Span>
              ))
            ) : activeMembers}
          </Div>
        </Div>

        <Div className="moa-chat-messages">
          {chat.messagesLoading ? (
            <AppLoadingSpinner label={t('moa_chat.messages_loading')} fill />
          ) : chat.messages.length === 0 ? (
            <Div className="moa-chat-messages__empty">
              {chat.activeConversation ? t('moa_chat.messages_empty') : t('moa_chat.choose_conversation')}
            </Div>
          ) : (
            <Div className="moa-chat-message-list">
              {chat.messages.map(item => {
                const isOwn = item.sender?.user_uuid && item.sender.user_uuid === currentUserUuid;
                return (
                  <Div
                    key={item.uuid}
                    className={`moa-chat-bubble glass-panel ${isOwn ? 'moa-chat-bubble--own' : 'moa-chat-bubble--other'}`}
                  >
                    <Div className="moa-chat-bubble__sender">
                      <ChatProfileNicknameButton
                        userUuid={item.sender?.user_uuid}
                        displayName={item.sender?.display_name ?? t('moa_chat.unknown_sender')}
                        className="text-xs font-medium text-muted"
                      />
                    </Div>
                    <Div className="moa-chat-bubble__body">{item.body}</Div>
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
              onChange={event => setMessage(event.target.value)}
            />
            <Button
              type="button"
              variant="primary"
              className="moa-chat-composer__send"
              disabled={!chat.activeConversation || !message.trim()}
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
