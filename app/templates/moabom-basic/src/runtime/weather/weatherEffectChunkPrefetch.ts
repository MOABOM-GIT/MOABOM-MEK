/**
 * 날씨 Canvas·엔진 청크 선로딩 — 마이페이지 설정 진입 시 백그라운드에서 준비한다.
 *
 * effective.weather 가 켜지기 전에 청크를 받아 두면 토글 ON 직후 체감 지연을 줄인다.
 * 홈 셸 본문·API 부트와 경쟁하지 않도록 idle 이후에만 시작한다.
 */

let chunkInflight: Promise<unknown> | null = null;

function schedulePrefetch(): void {
  if (typeof window === 'undefined' || chunkInflight) {
    return;
  }

  const start = (): void => {
    if (!chunkInflight) {
      chunkInflight = import('../../pages/home/Moa_WeatherEffectHostInner');
    }
  };

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => start(), { timeout: 4000 });
    return;
  }

  window.setTimeout(start, 1200);
}

/** 마이페이지 설정 등 — 날씨 토글 직전에 호출(중복 호출 안전). */
export function prefetchWeatherEffectChunk(): void {
  schedulePrefetch();
}

/** 청크 로드 완료를 기다린다(이미 로드됐으면 즉시 resolve). */
export function whenWeatherEffectChunkReady(): Promise<void> {
  if (!chunkInflight) {
    return Promise.resolve();
  }

  return chunkInflight.then(() => undefined);
}

/** 테스트 전용 — 모듈 상태 초기화. */
export function __resetWeatherEffectChunkPrefetchForTest(): void {
  chunkInflight = null;
}
