import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';

import type { EffectiveSystemOptions } from '../types';
import type { MoabomSystemDefaults } from '../../types/moabomSystem';
import { computeEffectiveSystemOptions } from '../effectiveSystemOptions';
import { loadMoabomSystemState, MOABOM_SYSTEM_STATE_CHANGED_EVENT } from '../../utils/moabomSystemStore';
import { classifyWeatherEffects } from './classifyWeatherEffects';
import {
  WEATHER_DEFAULT_PARTICLE_BUDGET,
  WEATHER_VISIBLE_REFETCH_GATE_MS,
} from './constants';
import { isMobileUserAgent, resolveParticleBudget } from '../env';
import {
  fetchWeatherGeolocate,
  fetchWeatherSnapshot,
  type WeatherLang,
} from './weatherApi';
import { getCurrentPositionAsync } from './getCurrentPositionAsync';
import { buildWeatherLocationKey } from './locationKey';
import { isLocationConsistentWithBrowserTimezone, isServerIpLocationPlausible } from './locationPlausibility';
import { loadLocationCache, saveLocationCache } from './locationCache';
import { loadServerIpLocationCache, saveServerIpLocationCache } from './serverIpLocationCache';
import {
  resolveWeatherLocation,
  type BrowserGeolocationResult,
  type ServerIpGeolocationResult,
} from './resolveWeatherLocation';
import { readSessionGeoDenied, writeSessionGeoDenied } from './sessionGeoDenied';
import { shouldRefetchOnVisible } from './shouldRefetchOnVisible';
import { shouldRender } from './shouldRender';
import {
  clearWeatherFetchError,
  isWeatherFetchErrorActive,
  saveWeatherFetchError,
  type WeatherFetchErrorReason,
} from './fetchStatusCache';
import {
  loadSnapshotCache,
  saveSnapshotCache,
  type SnapshotCacheEntry,
} from './snapshotCache';
import type {
  Weather_Location,
  Weather_Snapshot,
  WeatherEffectSet,
  WeatherLocationSource,
} from './types';
import { WeatherEffectEngine } from './WeatherEffectEngine';
import { whenMoabomBootPhaseAtLeast } from '../moabomShellBootPipeline';

export interface UseWeatherEffectRuntimeOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** 상위 훅 결과. `weather`·`animation` 만 관찰한다. */
  effective: Pick<EffectiveSystemOptions, 'weather' | 'animation'>;
  /** 서버 defaults(`systemDefaults`). 언어 결정용. */
  systemDefaults: MoabomSystemDefaults | null | undefined;
  /** 외부 연동 · 테스트에서 엔진·페치를 주입할 때 사용할 옵션들. */
  injected?: UseWeatherEffectRuntimeInjections;
}

export interface UseWeatherEffectRuntimeInjections {
  createEngine?: (canvas: HTMLCanvasElement) => WeatherEffectEngine;
  fetchSnapshot?: typeof fetchWeatherSnapshot;
  fetchGeolocate?: typeof fetchWeatherGeolocate;
  getCurrentPosition?: typeof getCurrentPositionAsync;
}

/**
 * 결정된 위치와 그 출처를 세션 동안 보관하기 위한 컨테이너.
 * `null` 이면 "아직 결정되지 않음", `source === 'unavailable'` 이면 "결정 시도했으나 모두 실패".
 */
interface ResolvedLocationRef {
  source: WeatherLocationSource;
  location: Weather_Location | null;
}

/**
 * `moabom-basic` 홈 셸의 Weather_Render_Loop 라이프사이클을 관리하는 React 훅.
 *
 * 본 훅의 **핵심 분리 원칙**(429 재발 방지):
 *
 *  - **위치 결정(`ensureLocation`) 은 세션당 1회**만 실질 외부 호출을 수행한다.
 *    `locationRef` 에 한 번 기록되면 이후 effective/visibility/intersecting 이 바뀌어도
 *    Geolocation 팝업이나 `/weather/geolocate` API 를 다시 호출하지 않는다.
 *    재계산이 필요한 순간은 오직 (a) 프로필 변경 이벤트, (b) 명시적 세션 리셋 뿐이다.
 *
 *  - **호출 순서는 요구사항 2 스펙대로**: 브라우저 Geolocation 을 우선 시도하고,
 *    성공하면 서버 IP geolocate 를 **호출하지 않는다**. 권한 거부·실패 시에만 IP 기반으로 폴백한다.
 *
 *  - **server IP 결과도 1 시간 localStorage 캐시**: 같은 네트워크에서는 1 시간 내에는 서버에 재호출하지 않는다.
 *
 *  - **스냅샷 페치(runOnceRef.current)** 는 위치가 확정된 뒤에만 발사되며, `shouldRender` 게이트가
 *    off 이면 engine.stop() 만 하고 끝낸다.
 *  - `MOABOM_SYSTEM_STATE_CHANGED_EVENT` 는 React 커밋보다 먼저 올 수 있으므로, 리스너에서
 *    `computeEffectiveSystemOptions(loadMoabomSystemState())` 로 `effectiveRef` 를 즉시 갱신하고
 *    엔진을 stop 한 뒤 `runOnce` 를 돌린다. `await` 이후에도 ref 기준으로 게이트를 재검사해
 *    지연 완료된 페치가 효과를 다시 켜는 레이스를 막는다.
 */
export function useWeatherEffectRuntime(options: UseWeatherEffectRuntimeOptions): void {
  const {
    canvasRef,
    effective,
    systemDefaults,
    injected,
  } = options;

  const fetchSnapshotImpl = injected?.fetchSnapshot ?? fetchWeatherSnapshot;
  const fetchGeolocateImpl = injected?.fetchGeolocate ?? fetchWeatherGeolocate;
  const getCurrentPositionImpl = injected?.getCurrentPosition ?? getCurrentPositionAsync;

  const [visibility, setVisibility] = useState<'visible' | 'hidden'>(() => readCurrentVisibility());
  const [intersecting, setIntersecting] = useState<boolean>(true);

  /** `MOABOM_SYSTEM_STATE_CHANGED_EVENT` 가 React 커밋보다 먼저 오므로, 게이트는 항상 ref 최신값으로 평가한다. */
  const effectiveRef = useRef<Pick<EffectiveSystemOptions, 'weather' | 'animation'>>(effective);
  const visibilityRef = useRef(visibility);
  const intersectingRef = useRef(intersecting);
  const systemDefaultsRef = useRef(systemDefaults);

  effectiveRef.current = effective;
  visibilityRef.current = visibility;
  intersectingRef.current = intersecting;
  systemDefaultsRef.current = systemDefaults;

  const engineRef = useRef<WeatherEffectEngine | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastFetchAtRef = useRef<number | null>(null);
  const lastLocationKeyRef = useRef<string | null>(null);
  /**
   * 세션 레퍼런스 — 한 번 결정된 위치를 여기에 캐시해 둔다. 훅 의존성이 바뀌어
   * runOnce 가 재실행되더라도 이 값이 있으면 외부 API 를 다시 때리지 않는다.
   */
  const locationRef = useRef<ResolvedLocationRef | null>(null);
  /** 위치 결정이 in-flight 중일 때 중복 호출을 막는 Promise 캐시. */
  const locationInflightRef = useRef<Promise<ResolvedLocationRef> | null>(null);
  const lang: WeatherLang = useMemo(() => {
    const stored = loadMoabomSystemState();
    return (stored.preferences.language ?? 'ko') as WeatherLang;
  }, [systemDefaults]);

  // ─────────────────────────────────────────────────────────────────────────
  // 엔진 생명주기

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return () => {};

    const engine = injected?.createEngine
      ? injected.createEngine(canvas)
      : new WeatherEffectEngine({
        canvas,
        initialBudget: resolveParticleBudget({
          isMobile: isMobileUserAgent(),
          hardwareConcurrency: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? 0 : 0,
          baseline: WEATHER_DEFAULT_PARTICLE_BUDGET,
        }),
      });
    engineRef.current = engine;
    // 마운트 직후·레이아웃 반영 후 버퍼/DPR transform 동기화 (HostInner 단독 resize 제거).
    engine.syncSurface();

    return () => {
      engine.stop();
      engineRef.current = null;
    };
  }, [canvasRef, injected?.createEngine]);

  // canvas 버퍼 크기 + DPR transform — width/height 변경 시 context 리셋 복구
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return () => {};

    const sync = (): void => {
      const engine = engineRef.current;
      if (!engine) return;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width > 0 ? rect.width : window.innerWidth;
      const height = rect.height > 0 ? rect.height : window.innerHeight;
      engine.syncSurface(width, height);
    };

    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [canvasRef]);

  // ─────────────────────────────────────────────────────────────────────────
  // visibilitychange · IntersectionObserver 구독

  useEffect(() => {
    if (typeof document === 'undefined') return () => {};
    const onChange = (): void => setVisibility(readCurrentVisibility());
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return () => {};
    if (typeof IntersectionObserver === 'undefined') {
      setIntersecting(true);
      return () => {};
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === canvas) {
            setIntersecting(entry.isIntersecting);
          }
        }
      },
      { root: null, threshold: 0 },
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canvasRef]);

  // ─────────────────────────────────────────────────────────────────────────
  // 위치 결정 — 세션당 1 회 실질 호출

  const ensureLocation = useCallback(async (): Promise<ResolvedLocationRef> => {
    // 1) 이미 결정된 결과가 있으면 즉시 반환(외부 호출 없음).
    const cached = locationRef.current;
    if (cached) return cached;

    // 2) in-flight 중이면 같은 Promise 를 공유.
    const inflight = locationInflightRef.current;
    if (inflight) return inflight;

    const promise = (async (): Promise<ResolvedLocationRef> => {
      // 2-1) browser Geolocation 을 우선 시도(세션 거부 플래그 체크).
      let browserResult: BrowserGeolocationResult;
      if (readSessionGeoDenied()) {
        browserResult = { kind: 'skipped' };
      } else {
        // localStorage 24h 캐시가 있으면 팝업을 띄우지 않고 그걸 사용.
        const cachedBrowser = loadLocationCache();
        if (cachedBrowser) {
          browserResult = { kind: 'success', location: cachedBrowser };
        } else {
          const geo = await getCurrentPositionImpl({
            timeout: 3000,
            maximumAge: 86_400_000,
            enableHighAccuracy: false,
          });
          if (geo.kind === 'denied') {
            writeSessionGeoDenied();
            browserResult = { kind: 'denied' };
          } else if (geo.kind === 'success') {
            saveLocationCache(geo.location);
            browserResult = { kind: 'success', location: geo.location };
          } else {
            browserResult = { kind: 'error' };
          }
        }
      }

      // 2-2) browser 가 성공했으면 server IP 호출 skip.
      let serverIpResult: ServerIpGeolocationResult;
      if (browserResult.kind === 'success') {
        serverIpResult = { kind: 'skipped' };
      } else {
        // server IP 결과도 로컬 1h 캐시가 있으면 API 호출 skip.
        const cachedIp = loadServerIpLocationCache();
        if (cachedIp) {
          serverIpResult = { kind: 'success', location: cachedIp };
        } else {
          const ctrl = new AbortController();
          try {
            const res = await fetchGeolocateImpl(ctrl.signal);
            if (res.kind === 'ok') {
              saveServerIpLocationCache(res.location);
              serverIpResult = { kind: 'success', location: res.location };
            } else if (res.kind === 'empty') {
              serverIpResult = { kind: 'empty' };
            } else {
              serverIpResult = { kind: 'error' };
            }
          } catch {
            serverIpResult = { kind: 'error' };
          }
        }
      }

      const resolved = resolveWeatherLocation({
        browserResult,
        serverIpResult,
        geoDeniedInSession: readSessionGeoDenied(),
      });

      return { source: resolved.source, location: resolved.location };
    })();

    locationInflightRef.current = promise;
    try {
      const result = await promise;
      locationRef.current = result;
      return result;
    } finally {
      locationInflightRef.current = null;
    }
  }, [fetchGeolocateImpl, getCurrentPositionImpl]);

  // ─────────────────────────────────────────────────────────────────────────
  // 메인 시퀀스: 게이트 합성 + 캐시된 위치 소비 + 스냅샷 페치 + 엔진 제어

  const runOnceRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const runOnce = useCallback(async (): Promise<void> => {
    const engine = engineRef.current;
    if (!engine) return;

    const isActive = (): boolean =>
      shouldRender({
        effective: effectiveRef.current,
        visibility: visibilityRef.current,
        intersecting: intersectingRef.current,
      });

    if (!isActive()) {
      engine.stop();
      abortInFlight(abortRef);
      return;
    }

    const resolved = await ensureLocation();
    if (!isActive()) {
      engine.stop();
      abortInFlight(abortRef);
      return;
    }
    if (resolved.source === 'unavailable' || !resolved.location) {
      engine.stop();
      return;
    }

    if (!isServerIpLocationPlausible(resolved.location, resolved.source)) {
      saveWeatherFetchError({
        at: new Date().toISOString(),
        reason: 'location_unreliable',
        locationKey: buildWeatherLocationKey(resolved.location, lang),
      });
      engine.stop();
      return;
    }

    const locationKey = buildWeatherLocationKey(resolved.location, lang);

    const cached = loadSnapshotCache();

    if (
      cached
      && cached.locationKey === locationKey
      && lastLocationKeyRef.current === locationKey
      && lastFetchAtRef.current !== null
      && Date.now() - lastFetchAtRef.current <= WEATHER_VISIBLE_REFETCH_GATE_MS
      && !isWeatherFetchErrorActive()
    ) {
      if (!isActive()) {
        engine.stop();
        abortInFlight(abortRef);
        return;
      }
      if (rejectUnreliableSnapshot(cached.data, locationKey)) {
        engine.stop();
        return;
      }
      applyToEngine(engine, cached.data);
      return;
    }

    if (abortRef.current && lastLocationKeyRef.current === locationKey) {
      return;
    }

    lastLocationKeyRef.current = locationKey;

    // 스냅샷 페치(조건부 헤더 포함).
    abortInFlight(abortRef);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const result = await fetchSnapshotImpl(resolved.location, lang, {
      etag: cached?.etag ?? null,
      ifModifiedSince: cached?.lastModified ?? null,
      signal: ctrl.signal,
    });

    abortRef.current = null;

    if (!isActive()) {
      engine.stop();
      abortInFlight(abortRef);
      return;
    }

    if (result.kind === 'ok') {
      clearWeatherFetchError();
      const entry: SnapshotCacheEntry = {
        data: result.snapshot,
        etag: result.etag,
        lastModified: result.lastModified,
        fetchedAt: new Date().toISOString(),
        locationKey,
      };
      saveSnapshotCache(entry);
      lastFetchAtRef.current = Date.now();
      if (rejectUnreliableSnapshot(result.snapshot, locationKey)) {
        engine.stop();
        return;
      }
      applyToEngine(engine, result.snapshot);
      return;
    }

    if (result.kind === 'not_modified' && cached && cached.locationKey === locationKey) {
      clearWeatherFetchError();
      const refreshed: SnapshotCacheEntry = {
        ...cached,
        fetchedAt: new Date().toISOString(),
        etag: result.etag ?? cached.etag,
        lastModified: result.lastModified ?? cached.lastModified,
      };
      saveSnapshotCache(refreshed);
      lastFetchAtRef.current = Date.now();
      if (rejectUnreliableSnapshot(cached.data, locationKey)) {
        engine.stop();
        return;
      }
      applyToEngine(engine, cached.data);
      return;
    }

    if (result.kind === 'error' && result.reason !== 'aborted') {
      // API 오류 시 오래된 localStorage 캐시(예: 뇌우)로 효과를 재생하지 않는다.
      saveWeatherFetchError({
        at: new Date().toISOString(),
        reason: result.reason as WeatherFetchErrorReason,
        locationKey,
      });
    }

    engine.stop();
  }, [effective.animation, effective.weather, ensureLocation, fetchSnapshotImpl, intersecting, lang, visibility]);

  useEffect(() => {
    runOnceRef.current = runOnce;
  }, [runOnce]);

  // 효과·가시성·위치 변경 시 시퀀스 재실행 — tertiary-idle 이후(부트 카탈로그·2차 API 이후).
  useEffect(() => {
    let cancelled = false;
    const cancelBoot = whenMoabomBootPhaseAtLeast('tertiary-idle', () => {
      if (!cancelled) {
        void runOnce();
      }
    });

    return () => {
      cancelled = true;
      cancelBoot();
      abortInFlight(abortRef);
    };
  }, [runOnce]);

  // ─────────────────────────────────────────────────────────────────────────
  // 시스템 옵션 변경 이벤트(MOABOM_SYSTEM_STATE_CHANGED_EVENT) 구독

  useEffect(() => {
    if (typeof window === 'undefined') return () => {};

    const readOsReducedMotion = (): boolean => {
      if (typeof window.matchMedia !== 'function') return false;
      try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
      } catch {
        return false;
      }
    };

    /** React 리렌더 전에도 localStorage + defaults 로 effective 를 맞춘다(마이페이지 토글 즉시 반영). */
    const syncEffectiveFromStorage = (): void => {
      const fresh = loadMoabomSystemState();
      const eff = computeEffectiveSystemOptions({
        adminOptions: systemDefaultsRef.current?.preferences?.system_options,
        userOverrides: fresh.preferences.systemOptions,
        osReducedMotion: readOsReducedMotion(),
      });
      effectiveRef.current = { weather: eff.weather, animation: eff.animation };
    };

    const onChange = (): void => {
      const prevWeather = effectiveRef.current.weather;
      const prevAnimation = effectiveRef.current.animation;
      syncEffectiveFromStorage();
      const weatherOptionsChanged =
        prevWeather !== effectiveRef.current.weather
        || prevAnimation !== effectiveRef.current.animation;

      engineRef.current?.stop();
      abortInFlight(abortRef);

      // 서버 pull·레이아웃 저장 등은 이벤트만 올리고 weather 토글은 안 바뀐다.
      // 이때 locationRef 를 비우면 `/weather/geolocate` 가 불필요하게 재호출된다.
      if (weatherOptionsChanged) {
        locationRef.current = null;
        locationInflightRef.current = null;
      }

      void runOnceRef.current();
    };
    window.addEventListener(MOABOM_SYSTEM_STATE_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(MOABOM_SYSTEM_STATE_CHANGED_EVENT, onChange);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // visibilitychange hidden→visible 재페치 게이트(Req 3.2)

  useEffect(() => {
    if (visibility !== 'visible') return () => {};
    const last = lastFetchAtRef.current;
    if (last !== null && shouldRefetchOnVisible(last, Date.now())) {
      void runOnceRef.current();
    }
    return () => {};
  }, [visibility]);
}

function abortInFlight(abortRef: { current: AbortController | null }): void {
  const ctrl = abortRef.current;
  if (ctrl) {
    try {
      ctrl.abort();
    } catch {
      /* ignore */
    }
    abortRef.current = null;
  }
}

function readCurrentVisibility(): 'visible' | 'hidden' {
  if (typeof document === 'undefined') return 'visible';
  return document.visibilityState === 'hidden' ? 'hidden' : 'visible';
}

function rejectUnreliableSnapshot(snapshot: Weather_Snapshot, locationKey: string): boolean {
  if (!snapshot.location || isLocationConsistentWithBrowserTimezone(snapshot.location)) {
    return false;
  }

  saveWeatherFetchError({
    at: new Date().toISOString(),
    reason: 'location_unreliable',
    locationKey,
  });
  return true;
}

function applyToEngine(engine: WeatherEffectEngine, snapshot: Weather_Snapshot): void {
  engine.setSnapshot(snapshot);
  const set: WeatherEffectSet = classifyWeatherEffects(snapshot);
  engine.setEffectSet(set);
  engine.start();
}
