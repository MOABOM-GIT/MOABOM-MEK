/**
 * 생성앱 창 오픈 시 카탈로그에서 가져온 즉시 실행 seed.
 * Viewer 가 show API 완료 전에 website_url 등으로 iframe 을 시작할 수 있게 한다.
 */

export type GeneratedAppOpenSeed = {
  appType?: string;
  websiteUrl?: string;
  title?: string;
  visibility?: string;
  tier?: string;
  launchMode?: string;
  /** 토큰 없는 공개 standard AI 앱 프리뷰 URL — show 완료 전 iframe 병렬 시작. */
  previewUrl?: string;
};

const seeds = new Map<number, GeneratedAppOpenSeed>();

export function setGeneratedAppOpenSeed(serverId: number, seed: GeneratedAppOpenSeed): void {
  if (!Number.isInteger(serverId) || serverId <= 0) {
    return;
  }
  seeds.set(serverId, seed);
}

export function peekGeneratedAppOpenSeed(serverId: number): GeneratedAppOpenSeed | null {
  return seeds.get(serverId) ?? null;
}

export function clearGeneratedAppOpenSeed(serverId: number): void {
  seeds.delete(serverId);
}

/** Vitest 격리 */
export function resetGeneratedAppOpenSeedsForTest(): void {
  seeds.clear();
}
