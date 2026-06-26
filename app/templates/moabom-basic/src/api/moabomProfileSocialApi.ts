import { createTransientShellModuleApi } from './moabomShellModuleRequest';
import {
  blockChatUser,
  fetchChatBlocks,
  fetchChatEligibility,
  unblockChatUser,
  type ChatBlock,
  type ChatEligibility,
} from './moabomChatApi';

const presenceApi = createTransientShellModuleApi('moabom-presence');

/** moabom-chat SSOT — 프로필·채팅 패널이 동일 엔드포인트·재시도 정책을 공유한다. */
export {
  fetchChatBlocks as profileSocialFetchBlocks,
  blockChatUser as profileSocialBlockUser,
  unblockChatUser as profileSocialUnblockUser,
  fetchChatEligibility as profileSocialFetchEligibility,
  type ChatBlock,
  type ChatEligibility,
};

export async function profileSocialRequestFriend(userUuid: string): Promise<void> {
  await presenceApi('user/friends', {
    method: 'POST',
    body: { user_uuid: userUuid },
  });
}

export async function profileSocialRemoveFriend(userUuid: string): Promise<void> {
  await presenceApi(`user/friends/${encodeURIComponent(userUuid)}`, {
    method: 'DELETE',
  });
}
