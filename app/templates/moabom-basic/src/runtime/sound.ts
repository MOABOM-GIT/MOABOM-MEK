import { MoabomRuntime } from './MoabomRuntime';

export interface PlayMoabomSoundOptions {
  /** 정적 자원 URL 또는 data: URL. */
  src: string;
  /** 볼륨 (0~1, 기본 1). */
  volume?: number;
  /**
   * 재생 직전 생성된 Audio 인스턴스를 받아 커스터마이즈할 hook (테스트용).
   * registry 등록 이전에 호출된다.
   */
  onAudioCreated?: (audio: HTMLAudioElement) => void;
}

/**
 * `playMoabomSound` 로 생성·재생된 인스턴스를 추적하는 registry.
 * `stopAllMoabomSounds` 는 본 registry 를 순회하며 `muted = true` 로 설정한다.
 *
 * registry 에 남는 항목은 외부 참조가 없어도 "sound off 전환 시 즉각 무음화" 를 위해
 * 의도적으로 보관한다. 페이지 라이프사이클 끝에 해제되므로 수명은 세션 이내다.
 */
const audioRegistry = new Set<HTMLAudioElement>();

/**
 * moabom-basic 템플릿의 UI 사운드 재생을 담당하는 **단일 진입점**.
 *
 * 동작(Req 3.1 ~ 3.4):
 * - `MoabomRuntime.getEffectiveOption('sound') === false` 이면:
 *   1) 새 `Audio` 인스턴스를 생성하지 않는다(Req 3.1).
 *   2) registry 에 보관된 기존 인스턴스들의 `muted = true` 로 설정해
 *      이미 재생 중인 루프도 즉시 조용해지도록 한다(Req 3.2).
 * - `sound === true` 이면 `new Audio(src)` 를 생성해 `play()` 하고,
 *   자동재생 정책 위반(`NotAllowedError` 등) 으로 Promise 가 reject 되면
 *   `console.warn` 으로만 로깅한다(Req 3.3).
 *   재생된 인스턴스는 registry 에 등록되어 이후 off 전환 시 일괄 mute 된다.
 *
 * @remarks 현재 코드베이스에는 기존 사운드 호출부가 없으므로, 본 유틸은
 * "앞으로 사운드 추가 시 반드시 경유할 진입점" 역할을 한다.
 */
export function playMoabomSound(options: PlayMoabomSoundOptions): void {
  const enabled = MoabomRuntime.getEffectiveOption('sound');

  if (!enabled) {
    // off 전환 시점에 이미 registry 에 쌓여 있던 인스턴스를 즉시 mute
    for (const existing of audioRegistry) {
      try {
        existing.muted = true;
      } catch {
        // DOM 노드가 이미 분리된 경우는 무시
      }
    }
    return;
  }

  // `Audio` 전역은 jsdom 환경에서 없을 수 있다 — 방어적으로 체크
  if (typeof Audio !== 'function') {
    return;
  }

  let audio: HTMLAudioElement;
  try {
    audio = new Audio(options.src);
  } catch (err) {
    console.warn('[moabom-basic] playMoabomSound: failed to create Audio', err);
    return;
  }

  try {
    audio.volume = typeof options.volume === 'number' ? options.volume : 1;
  } catch {
    // volume 설정 실패는 치명적이지 않다
  }

  try {
    options.onAudioCreated?.(audio);
  } catch (err) {
    // 테스트 훅에서 throw 해도 재생 경로는 계속 진행
    console.warn('[moabom-basic] playMoabomSound: onAudioCreated threw', err);
  }

  audioRegistry.add(audio);

  // `play()` 는 Promise 를 반환하므로 rejection 을 반드시 흡수한다(Req 3.3).
  try {
    const result = audio.play();
    if (result && typeof (result as Promise<void>).then === 'function') {
      (result as Promise<void>).catch((err) => {
        console.warn('[moabom-basic] playMoabomSound: playback rejected', err);
      });
    }
  } catch (err) {
    console.warn('[moabom-basic] playMoabomSound: play() threw', err);
  }
}

/**
 * registry 에 보관된 모든 `HTMLAudioElement` 를 즉시 mute 한다.
 *
 * `useEffectiveSystemOptions` 훅이 `sound` 값의 `true → false` 전환을 감지했을 때 호출한다.
 * 등록된 인스턴스 자체는 제거하지 않는다(이후 on 전환 시 `muted = false` 를 다시 주도록
 * 별도 경로가 필요하면 도입할 것이며, 현 스펙 범위 밖).
 */
export function stopAllMoabomSounds(): void {
  for (const audio of audioRegistry) {
    try {
      audio.muted = true;
    } catch {
      // 분리된 노드 · 프로토타입 패치로 인한 실패는 silently skip
    }
  }
}

/**
 * 테스트 전용 — registry 를 비운다. 프로덕션 코드에서 호출하지 말 것.
 * @internal
 */
export function __resetMoabomSoundRegistryForTesting(): void {
  audioRegistry.clear();
}
