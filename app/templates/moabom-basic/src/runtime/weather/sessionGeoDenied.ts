/**
 * 세션 단위 Geolocation 권한 거부 플래그(Req 2.4).
 *
 * 사용자가 현재 탭에서 `PositionError.PERMISSION_DENIED` 를 관측한 적이 있는지를
 * `sessionStorage` 로 기록해 같은 세션 내 반복 팝업을 방지한다. 브라우저 재실행·탭 재오픈 시
 * sessionStorage 가 초기화되므로 다음 방문에서는 자연스럽게 다시 시도된다.
 */

const SESSION_KEY = 'moabom_weather_geo_denied';

export function readSessionGeoDenied(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeSessionGeoDenied(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    /* ignore */
  }
}

/** 테스트 전용 — 플래그 초기화. */
export function __clearSessionGeoDeniedForTesting(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
