/** 홈 셸 그리드·런처 순서 — `user/settings` JSON `shell.home` 네임스페이스 */
export interface MoabomShellHomeSettings {
  mainAppOrder: string[];
}

export interface MoabomShellSettings {
  home: MoabomShellHomeSettings;
}
