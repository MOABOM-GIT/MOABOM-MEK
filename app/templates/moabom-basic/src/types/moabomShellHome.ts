/** 홈 셸 그리드·런처 순서 — `user/settings` JSON `shell.home` 네임스페이스 */
export interface MoabomShellHomeSettings {
  mainAppOrder: string[];
  /** true = 사용자가 메인 그리드를 편집함(빈 배열도 의도적 빈 그리드) */
  mainAppOrderCustomized?: boolean;
}

export interface MoabomShellSettings {
  home: MoabomShellHomeSettings;
}
