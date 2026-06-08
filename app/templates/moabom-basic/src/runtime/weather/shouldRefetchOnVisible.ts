import { WEATHER_VISIBLE_REFETCH_GATE_MS } from './constants';

/**
 * 탭이 `hidden → visible` 로 전이했을 때 Weather_Snapshot 을 재페치해야 하는지 판단한다(Req 3.2).
 *
 * 규칙: `(nowMs - lastFetchedAtMs) > WEATHER_VISIBLE_REFETCH_GATE_MS` 일 때만 `true`.
 * 경계 직전(30분 - 1ms) 은 `false`, 직후(30분 + 1ms) 는 `true` — Property 8(P-RefetchGate).
 *
 * 음수 입력이나 미래 시각(`nowMs < lastFetchedAtMs`) 은 "아직 재페치 필요 없음" 으로 간주해 `false` 를 반환한다.
 *
 * @param lastFetchedAtMs 직전 페치 시각(epoch ms). 스냅샷이 아예 없으면 본 함수를 호출하지 않는다.
 * @param nowMs           현재 시각(epoch ms).
 */
export function shouldRefetchOnVisible(lastFetchedAtMs: number, nowMs: number): boolean {
  if (!Number.isFinite(lastFetchedAtMs) || !Number.isFinite(nowMs)) return false;
  const elapsed = nowMs - lastFetchedAtMs;
  if (elapsed <= 0) return false;
  return elapsed > WEATHER_VISIBLE_REFETCH_GATE_MS;
}
