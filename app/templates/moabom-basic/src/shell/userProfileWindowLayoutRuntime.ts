import {
  loadG7LayoutWindowPayload,
  type BoardWindowRenderPayload,
} from './boardWindowLayoutRuntime';

/** moabom-presence 모듈 user 레이아웃 — DB 등록명 `{module}.{layout_name}` */
export const USER_PROFILE_LAYOUT_PATH = 'moabom-presence.user/public_profile';

export async function loadUserProfileWindowRenderPayload(
  userUuid: string,
): Promise<BoardWindowRenderPayload> {
  return loadG7LayoutWindowPayload(USER_PROFILE_LAYOUT_PATH, { uuid: userUuid });
}

export function resolveUserProfileWindowTitle(
  fetched: Record<string, unknown>,
): string | null {
  const profile = fetched.user_profile as { data?: { name?: string } } | undefined;
  const name = profile?.data?.name?.trim();
  return name || null;
}
