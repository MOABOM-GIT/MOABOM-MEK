import { useEffect, useMemo, useRef, useState } from 'react';

import type { MoabomSystemDefaults, MoabomSystemState } from '../types/moabomSystem';
import {
  loadMoabomSystemState,
  MOABOM_SYSTEM_STATE_CHANGED_EVENT,
  MOABOM_SYSTEM_STORAGE_KEY,
} from '../utils/moabomSystemStore';
import { areMoabomSystemStatesEqual } from '../utils/moabomSystemStore';
import { computeEffectiveSystemOptions } from './effectiveSystemOptions';
import { MOABOM_RUNTIME_OPTIONS_CHANGED_EVENT } from './events';
import { MoabomRuntime } from './MoabomRuntime';
import { stopAllMoabomSounds } from './sound';
import type { EffectiveSystemOptions } from './types';

/**
 * `useEffectiveSystemOptions` 훅의 입력 스키마.
 *
 * - `systemDefaults` : 최상위에서 이미 페치한 Public_Defaults_API · User_Settings_API 응답.
 *   비로그인 셸도 이 값으로 관리자 기본값을 공급받아 Effective_Option_Value 를 계산한다.
 */
export interface UseEffectiveSystemOptionsOptions {
  systemDefaults: MoabomSystemDefaults | null | undefined;
}

const EMPTY_REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function shallowEqual(a: EffectiveSystemOptions, b: EffectiveSystemOptions): boolean {
  return (
    a.sound === b.sound &&
    a.animation === b.animation &&
    a.haptic === b.haptic &&
    a.toast === b.toast &&
    a.weather === b.weather
  );
}

function readReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia(EMPTY_REDUCED_MOTION_QUERY).matches === true;
  } catch {
    return false;
  }
}

/**
 * 시스템 옵션의 Effective_Option_Value 를 구독·재계산하는 React 훅.
 *
 * 입력 변화:
 * - `MoabomSystemState` (localStorage) 변경 — 동탭 `MOABOM_SYSTEM_STATE_CHANGED_EVENT`,
 *   다른 탭 `storage` 이벤트(키 `MOABOM_SYSTEM_STORAGE_KEY`) 양쪽을 구독한다.
 *   → Req 11.1 / 11.3 (500ms 이내 전파)
 * - `matchMedia('(prefers-reduced-motion: reduce)')` `change` 이벤트
 *   → Req 2.5 (250ms 이내 animation 재계산)
 * - `systemDefaults` prop 변경 — 상위 컴포넌트가 서버 응답을 갱신했을 때.
 *   → Req 11.1
 *
 * 출력:
 * - React 렌더용 참조 안정(`useMemo` + shallow compare) 한 `EffectiveSystemOptions`.
 * - 부수 효과로 `MoabomRuntime._setEffectiveOptions` 갱신(동기 getter 계약 · Req 11 전반)
 *   및 `MOABOM_RUNTIME_OPTIONS_CHANGED_EVENT` dispatch(Toast 등 getter 소비자 리렌더).
 * - `sound` 가 `true → false` 로 전환되면 `stopAllMoabomSounds()` 를 호출해
 *   registry 의 기존 오디오를 즉시 mute 한다(Req 3.2).
 *
 * 훅 외부(유틸 · 이벤트 핸들러)에서는 값 경로 대신 `MoabomRuntime.getEffectiveOption(id)` 를 사용한다.
 */
export function useEffectiveSystemOptions(
  options: UseEffectiveSystemOptionsOptions,
): EffectiveSystemOptions {
  const { systemDefaults } = options;

  const [systemState, setSystemState] = useState<MoabomSystemState>(() => loadMoabomSystemState());
  const [osReducedMotion, setOsReducedMotion] = useState<boolean>(() => readReducedMotion());

  // 동탭 · 다른 탭의 MoabomSystemState 변경을 구독 → localStorage 재읽기
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const refresh = (): void => {
      setSystemState(prev => {
        const disk = loadMoabomSystemState();
        return areMoabomSystemStatesEqual(prev, disk) ? prev : disk;
      });
    };

    const handleStorage = (event: StorageEvent): void => {
      if (event.key === MOABOM_SYSTEM_STORAGE_KEY) {
        refresh();
      }
    };

    window.addEventListener(MOABOM_SYSTEM_STATE_CHANGED_EVENT, refresh);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(MOABOM_SYSTEM_STATE_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // prefers-reduced-motion 변화 구독
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    let mql: MediaQueryList;
    try {
      mql = window.matchMedia(EMPTY_REDUCED_MOTION_QUERY);
    } catch {
      return;
    }

    const handleChange = (event: MediaQueryListEvent): void => {
      setOsReducedMotion(event.matches === true);
    };

    // 초기값 동기화 — 마운트 시점 다른 구독 상태 사이의 드리프트 방지
    setOsReducedMotion(mql.matches === true);

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handleChange);
      return () => mql.removeEventListener('change', handleChange);
    }
    // 구형 Safari 폴백
    const legacyMql = mql as MediaQueryList & {
      addListener?: (listener: (e: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (e: MediaQueryListEvent) => void) => void;
    };
    legacyMql.addListener?.(handleChange);
    return () => legacyMql.removeListener?.(handleChange);
  }, []);

  // 참조 안정화 — effective 값이 shallow-equal 로 동일하면 이전 객체를 유지한다.
  const prevRef = useRef<EffectiveSystemOptions | null>(null);
  const effective = useMemo<EffectiveSystemOptions>(() => {
    const next = computeEffectiveSystemOptions({
      adminOptions: systemDefaults?.preferences?.system_options,
      userOverrides: systemState.preferences.systemOptions,
      osReducedMotion,
    });
    const prev = prevRef.current;
    if (prev && shallowEqual(prev, next)) {
      return prev;
    }
    prevRef.current = next;
    return next;
  }, [systemDefaults, systemState, osReducedMotion]);

  // 전역 레지스트리 갱신 + 변경 이벤트 발행 + sound off 전환 처리
  const lastDispatchedRef = useRef<EffectiveSystemOptions | null>(null);
  useEffect(() => {
    const previous = lastDispatchedRef.current;
    if (previous === effective) return;

    MoabomRuntime._setEffectiveOptions(effective);
    lastDispatchedRef.current = effective;

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(MOABOM_RUNTIME_OPTIONS_CHANGED_EVENT));
    }

    // sound 가 off 로 전환되면 기존 재생 중 인스턴스를 즉시 mute (Req 3.2)
    if (previous?.sound === true && effective.sound === false) {
      try {
        stopAllMoabomSounds();
      } catch {
        // 유틸이 아직 등록한 인스턴스가 없으면 no-op
      }
    }
  }, [effective]);

  return effective;
}
