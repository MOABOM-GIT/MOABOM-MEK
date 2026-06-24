import { describe, expect, it } from 'vitest';
import {
  extractChatNotificationTarget,
  extractChatConversationUuidFromUrl,
  extractChatSenderUuidFromUrl,
} from '../moabomChatNotificationNavigate';

describe('moabomChatNotificationNavigate', () => {
  const senderUuid = '00000000-0000-4000-8000-000000000001';
  const conversationUuid = '00000000-0000-4000-8000-000000000099';

  it('알림 url 에서 발신자·대화방 uuid 를 추출한다', () => {
    const url = `/users/${senderUuid}/chat?conversation=${conversationUuid}`;
    expect(extractChatSenderUuidFromUrl(url)).toBe(senderUuid);
    expect(extractChatConversationUuidFromUrl(url)).toBe(conversationUuid);
  });

  it('chat_message 알림 데이터에서 대화 이동 대상을 만든다', () => {
    const target = extractChatNotificationTarget({
      type: 'chat_message',
      url: `/users/${senderUuid}/chat`,
      data: {
        click_url: `/users/${senderUuid}/chat?conversation=${conversationUuid}`,
        data: {
          sender_uuid: senderUuid,
          conversation_uuid: conversationUuid,
        },
      },
    });

    expect(target).toEqual({
      peerUserUuid: senderUuid,
      conversationUuid,
    });
  });

  it('chat_message 가 아니면 null 을 반환한다', () => {
    expect(extractChatNotificationTarget({
      type: 'board.comment_received',
      url: '/board/notice/1',
    })).toBeNull();
  });
});
