import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Moa_OverflowMarqueeText } from './Moa_OverflowMarqueeText';

/**
 * 테스트 가능한 ResizeObserver 스텁.
 *
 * 인스턴스의 callback 을 보관해 두었다가 testutil 에서 강제로 트리거할 수 있게 한다.
 * 실제 브라우저 동작을 흉내내지는 않으며, 오버플로 판정 전환 로직을 검증하기 위한 훅 포인트이다.
 */
type ObserverCallback = ResizeObserverCallback;
const resizeObserverInstances: Array<{ trigger: () => void; disconnect: () => void }> = [];

function installResizeObserverStub(): void {
  class StubResizeObserver {
    private readonly callback: ObserverCallback;

    constructor(callback: ObserverCallback) {
      this.callback = callback;
      resizeObserverInstances.push({
        trigger: () => this.callback([], this as unknown as ResizeObserver),
        disconnect: () => {},
      });
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal('ResizeObserver', StubResizeObserver);
}

/**
 * jsdom 은 기본적으로 scrollWidth / clientWidth / offsetWidth 를 0 으로 반환한다.
 * 오버플로 판정 경로를 타게 하려면 이 값들을 직접 주입해야 한다.
 */
function mockLayoutWidths(options: {
  clientWidth: number;
  scrollWidth: number;
  offsetWidth?: number;
}): void {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      // outer 컨테이너 뿐 아니라 마퀴 gap span 등도 clientWidth 를 읽는다.
      // 태그/클래스로 분기해 현실적인 값을 반환.
      if (this instanceof HTMLSpanElement && this.className.includes('measure')) {
        return 0;
      }
      return options.clientWidth;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get() {
      if (this instanceof HTMLSpanElement && this.className.includes('measure')) {
        return options.scrollWidth;
      }
      return options.scrollWidth;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      return options.offsetWidth ?? options.scrollWidth;
    },
  });
}

function restoreLayoutWidths(): void {
  // 기본 HTMLElement 프로토타입의 getter 들을 원복. jsdom 기본 동작(0 반환) 로 되돌림.
  for (const prop of ['clientWidth', 'scrollWidth', 'offsetWidth'] as const) {
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get() {
        return 0;
      },
    });
  }
}

describe('Moa_OverflowMarqueeText', () => {
  beforeEach(() => {
    installResizeObserverStub();
    resizeObserverInstances.length = 0;
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    restoreLayoutWidths();
  });

  it('주어진 텍스트를 렌더하고 기본 title 에 텍스트를 사용한다', () => {
    render(<Moa_OverflowMarqueeText text="Hello Moabom" />);
    expect(screen.getByTitle('Hello Moabom')).toBeInTheDocument();
  });

  it('빈 문자열이면 아무것도 렌더하지 않는다 (null 반환)', () => {
    const { container } = render(<Moa_OverflowMarqueeText text="" />);
    expect(container.firstChild).toBeNull();
  });

  it('명시된 title prop 이 있으면 text 대신 title 로 네이티브 툴팁을 설정한다', () => {
    render(<Moa_OverflowMarqueeText text="짧은이름" title="전체 설명이 들어간 긴 툴팁" />);
    // getByTitle 은 title 속성 매칭. text 가 아닌 title 로 찾혀야 함.
    expect(screen.getByTitle('전체 설명이 들어간 긴 툴팁')).toBeInTheDocument();
  });

  it('wrapperClassName / className 이 래퍼와 내부 Span 에 모두 반영된다', () => {
    const { container } = render(
      <Moa_OverflowMarqueeText
        text="style test"
        wrapperClassName="custom-wrapper"
        className="custom-inner"
      />,
    );
    const wrapper = container.querySelector('.moa-overflow-marquee');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.className).toContain('custom-wrapper');

    // 비오버플로 경로에서는 __inner--ellipsis span 에 className 이 함께 붙는다.
    const ellipsis = container.querySelector('.moa-overflow-marquee__inner--ellipsis');
    expect(ellipsis).not.toBeNull();
    expect(ellipsis?.className).toContain('custom-inner');
  });

  it('ResizeObserver 가 없는 환경(jsdom SSR 유사)에서도 예외 없이 렌더된다', () => {
    // 먼저 현재 스텁을 제거
    vi.unstubAllGlobals();
    vi.stubGlobal('ResizeObserver', undefined);

    expect(() => render(<Moa_OverflowMarqueeText text="safe" />)).not.toThrow();
    expect(screen.getByTitle('safe')).toBeInTheDocument();
  });

  it('기본 렌더 시 단일 ellipsis span 만 존재하고 마퀴 트랙은 렌더되지 않는다 (오버플로 미감지)', () => {
    // jsdom 기본값(모든 width=0) 하에서는 measure 가 early-return 되어 overflow=false 유지.
    const { container } = render(<Moa_OverflowMarqueeText text="반짝이 이름" />);
    expect(container.querySelector('.moa-overflow-marquee__inner--ellipsis')).not.toBeNull();
    expect(container.querySelector('.moa-overflow-marquee__track')).toBeNull();
    expect(container.querySelector('.moa-overflow-marquee')?.className).not.toContain(
      'moa-overflow-marquee--active',
    );
  });

  it('측정 결과 scrollWidth 가 clientWidth 를 충분히 초과하면 마퀴 트랙으로 전환된다', () => {
    // 오버플로 판정 임계값(OVERFLOW_HYSTERESIS_PX=6) 보다 여유 있게 차이 설정
    mockLayoutWidths({ clientWidth: 100, scrollWidth: 400, offsetWidth: 400 });

    const { container } = render(
      <Moa_OverflowMarqueeText text="아주 길어서 한 줄에 다 들어가지 않는 텍스트입니다" />,
    );

    // measure 는 useLayoutEffect 마운트 시 동기 실행되므로 이 시점에 이미 판정 완료.
    const track = container.querySelector('.moa-overflow-marquee__track');
    expect(track).not.toBeNull();

    // 두 개의 seg 와 하나의 gap 이 존재 (seamless loop 를 위한 2 배 렌더)
    const segs = container.querySelectorAll('.moa-overflow-marquee__seg');
    expect(segs.length).toBe(2);
    const gap = container.querySelector('.moa-overflow-marquee__gap');
    expect(gap).not.toBeNull();

    const root = container.querySelector('.moa-overflow-marquee');
    expect(root?.className).toContain('moa-overflow-marquee--active');
  });
});
