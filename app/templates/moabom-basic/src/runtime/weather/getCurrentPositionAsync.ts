import type { Weather_Location } from './types';

export interface GetCurrentPositionOptions {
  timeout: number;
  maximumAge: number;
  enableHighAccuracy?: boolean;
}

export type GetCurrentPositionResult =
  | { kind: 'success'; location: Weather_Location }
  | { kind: 'denied' }
  | { kind: 'error' };

/**
 * `navigator.geolocation.getCurrentPosition` 을 Promise 로 래핑한다(설계 §2.3).
 *
 * 계약:
 *  - `navigator.geolocation` 미지원 → `{ kind: 'error' }`.
 *  - `PositionError.PERMISSION_DENIED` → `{ kind: 'denied' }`.
 *  - 그 외 오류(타임아웃 · POSITION_UNAVAILABLE 등) → `{ kind: 'error' }`.
 *  - 본 함수는 어떤 경우에도 예외를 throw 하지 않는다. 결과 객체로만 실패를 전달한다.
 */
export function getCurrentPositionAsync(
  options: GetCurrentPositionOptions = { timeout: 3000, maximumAge: 86_400_000, enableHighAccuracy: false },
): Promise<GetCurrentPositionResult> {
  return new Promise<GetCurrentPositionResult>((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ kind: 'error' });
      return;
    }

    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            kind: 'success',
            location: {
              lat: position.coords.latitude,
              lon: position.coords.longitude,
            },
          });
        },
        (err) => {
          // 브라우저 env 에 따라 PERMISSION_DENIED 상수가 없을 수 있어 숫자 비교 병행.
          const DENIED = (typeof GeolocationPositionError !== 'undefined'
            && (GeolocationPositionError as unknown as { PERMISSION_DENIED?: number }).PERMISSION_DENIED)
            ?? 1;
          if (err?.code === DENIED) {
            resolve({ kind: 'denied' });
          } else {
            resolve({ kind: 'error' });
          }
        },
        {
          timeout: options.timeout,
          maximumAge: options.maximumAge,
          enableHighAccuracy: options.enableHighAccuracy ?? false,
        },
      );
    } catch {
      resolve({ kind: 'error' });
    }
  });
}
