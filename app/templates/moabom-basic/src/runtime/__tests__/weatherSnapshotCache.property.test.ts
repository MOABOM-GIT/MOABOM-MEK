// Feature: moabom-home-weather-effect, Property 6: 2-hour stale-while-error boundary
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { isSnapshotCacheUsableAsStale, type SnapshotCacheEntry } from '../weather/snapshotCache';
import { WEATHER_SNAPSHOT_STALE_MAX_MS } from '../weather/constants';
import type { Weather_Snapshot } from '../weather/types';

/**
 * Property 6 — P-StaleWhileError.
 *
 * `isSnapshotCacheUsableAsStale(entry, now, currentLocationKey, staleMaxMs)` 반환값 ≡
 *   entry !== null
 *   && entry.locationKey === currentLocationKey
 *   && Number.isFinite(Date.parse(entry.fetchedAt))
 *   && now.getTime() >= Date.parse(entry.fetchedAt)
 *   && (now.getTime() - Date.parse(entry.fetchedAt)) < staleMaxMs.
 *
 * Validates: Requirements 3.5, 3.6.
 */

function emptySnapshot(): Weather_Snapshot {
  return {
    weather_code: 0,
    wind_speed_10m: 0,
    wind_direction_10m: 0,
    temperature_2m: 0,
    is_day: 1,
    pm2_5: null,
    pm10: null,
    dust: null,
    sunrise: null,
    sunset: null,
    fetched_at: '2026-05-12T00:00:00+09:00',
    location: { lat: 0, lon: 0 },
  };
}

function makeEntry(overrides: Partial<SnapshotCacheEntry>): SnapshotCacheEntry {
  return {
    data: emptySnapshot(),
    etag: null,
    lastModified: null,
    fetchedAt: '2026-05-12T00:00:00.000Z',
    locationKey: '37.5:127.0:ko',
    ...overrides,
  };
}

const KEY = '37.5:127.0:ko';

describe('Property 6 — P-StaleWhileError (isSnapshotCacheUsableAsStale)', () => {
  it('유한한 입력 전수에 대해 네 조건의 AND 합성과 동치이다', () => {
    fc.assert(
      fc.property(
        // 임의 epoch ms(과거~미래 섞임)
        fc.integer({ min: 0, max: 2_000_000_000_000 }),
        fc.integer({ min: 0, max: 2_000_000_000_000 }),
        // entry 존재 유무(null 도 허용)
        fc.boolean(),
        // 위치 키 매치 여부(동일 키 vs 다른 키)
        fc.boolean(),
        (fetchedAtMs, nowMs, hasEntry, sameKey) => {
          const entry = hasEntry
            ? makeEntry({
              fetchedAt: new Date(fetchedAtMs).toISOString(),
              locationKey: sameKey ? KEY : 'other',
            })
            : null;

          const now = new Date(nowMs);
          const actual = isSnapshotCacheUsableAsStale(entry, now, KEY, WEATHER_SNAPSHOT_STALE_MAX_MS);

          let expected = false;
          if (entry && entry.locationKey === KEY) {
            const elapsed = nowMs - fetchedAtMs;
            expected = elapsed >= 0 && elapsed < WEATHER_SNAPSHOT_STALE_MAX_MS;
          }

          return actual === expected;
        },
      ),
      { numRuns: 400 },
    );
  });

  it('2h 경계 직전(2h - 1ms) 은 true, 경계(2h) 는 false, 직후(2h + 1ms) 는 false', () => {
    const base = 1_700_000_000_000;
    const fetched = new Date(base).toISOString();
    const entry = makeEntry({ fetchedAt: fetched, locationKey: KEY });

    expect(
      isSnapshotCacheUsableAsStale(entry, new Date(base + WEATHER_SNAPSHOT_STALE_MAX_MS - 1), KEY, WEATHER_SNAPSHOT_STALE_MAX_MS),
    ).toBe(true);
    expect(
      isSnapshotCacheUsableAsStale(entry, new Date(base + WEATHER_SNAPSHOT_STALE_MAX_MS), KEY, WEATHER_SNAPSHOT_STALE_MAX_MS),
    ).toBe(false);
    expect(
      isSnapshotCacheUsableAsStale(entry, new Date(base + WEATHER_SNAPSHOT_STALE_MAX_MS + 1), KEY, WEATHER_SNAPSHOT_STALE_MAX_MS),
    ).toBe(false);
  });

  it('위치 키가 다르면 항상 false — 먼 도시의 값을 재사용하지 않는다', () => {
    const entry = makeEntry({ locationKey: '40.7:-74.0:en' });
    expect(isSnapshotCacheUsableAsStale(entry, new Date(), KEY, WEATHER_SNAPSHOT_STALE_MAX_MS)).toBe(false);
  });

  it('fetchedAt 이 파싱 불가능하거나 미래(음의 경과) 이면 false', () => {
    const entry = makeEntry({ fetchedAt: 'not-a-date' });
    expect(isSnapshotCacheUsableAsStale(entry, new Date(), KEY, WEATHER_SNAPSHOT_STALE_MAX_MS)).toBe(false);

    const future = new Date(Date.now() + 10_000).toISOString();
    const futureEntry = makeEntry({ fetchedAt: future });
    expect(
      isSnapshotCacheUsableAsStale(futureEntry, new Date(Date.now()), KEY, WEATHER_SNAPSHOT_STALE_MAX_MS),
    ).toBe(false);
  });
});
