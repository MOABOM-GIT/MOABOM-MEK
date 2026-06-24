/** 창 너비(px)에 따른 타이틀 최대 글자 수 — 최소 10자부터 단계적으로 확대 */
export function resolveShellWindowTitleLimit(windowWidth: number): number {
  if (windowWidth < 400) return 10;
  if (windowWidth < 480) return 12;
  if (windowWidth < 640) return 16;
  if (windowWidth < 768) return 20;
  if (windowWidth < 1024) return 26;
  return 36;
}

/** 두 줄 타이틀 방지 — 창 너비 기준 글자 수 제한 */
export function truncateShellWindowTitle(title: string, windowWidth: number): string {
  const trimmed = title.trim();
  if (!trimmed) {
    return trimmed;
  }
  const limit = resolveShellWindowTitleLimit(windowWidth);
  if (trimmed.length <= limit) {
    return trimmed;
  }
  if (limit <= 1) {
    return trimmed.slice(0, limit);
  }
  return `${trimmed.slice(0, limit - 1)}…`;
}
