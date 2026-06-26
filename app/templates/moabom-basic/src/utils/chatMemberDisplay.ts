import type { ChatMember } from '../api/moabomChatApi';

/** 채팅 UI 상단·목록용 닉네임 (없으면 display_name). */
export function chatMemberNickname(member: ChatMember): string {
  const nickname = member.nickname?.trim();
  if (nickname) {
    return nickname;
  }
  return member.display_name;
}

/** 채팅 UI 부제목용 실명 (없으면 display_name). */
export function chatMemberRealName(member: ChatMember): string {
  const realName = member.real_name?.trim();
  if (realName) {
    return realName;
  }
  return member.display_name;
}

export function shouldShowChatMemberRealName(member: ChatMember): boolean {
  const nickname = chatMemberNickname(member);
  const realName = chatMemberRealName(member);
  return realName !== '' && realName !== nickname;
}
