export type MoabomShellPendingChatNavigation = {
  peerUserUuid: string;
  conversationUuid: string | null;
  /** 프로필 액션에서 eligibility 확인 후 chat 탭 오픈 — auto-start 중복 방지 */
  eligibilityVerified?: boolean;
};

let pending: MoabomShellPendingChatNavigation | null = null;

export function setMoabomShellPendingChatNavigation(nav: MoabomShellPendingChatNavigation): void {
  pending = nav;
}

export function peekMoabomShellPendingChatNavigation(): MoabomShellPendingChatNavigation | null {
  return pending;
}

export function consumeMoabomShellPendingChatNavigation(): MoabomShellPendingChatNavigation | null {
  const current = pending;
  pending = null;
  return current;
}
