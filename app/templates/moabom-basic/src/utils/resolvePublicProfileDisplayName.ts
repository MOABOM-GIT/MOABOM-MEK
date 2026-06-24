export type PublicProfileNameFields = {
  nickname?: string | null;
  name?: string | null;
};

/** 공개 프로필·접속자 목록과 동일 — 닉네임 우선, 없으면 실명 */
export function resolvePublicProfileDisplayName(
  profile?: PublicProfileNameFields | null,
): string | null {
  const nickname = profile?.nickname?.trim();
  if (nickname) {
    return nickname;
  }

  const name = profile?.name?.trim();
  return name || null;
}
