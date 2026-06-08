import React, { useLayoutEffect, useRef, useState } from 'react';
import { Div } from '../basic/Div';
import { Span } from '../basic/Span';

export interface Moa_OverflowMarqueeTextProps {
  /** 표시할 텍스트 */
  text: string;
  /** 내부 텍스트에 붙는 클래스(타이포 등) */
  className?: string;
  /** 래퍼에 붙는 클래스 */
  wrapperClassName?: string;
  /** 네이티브 툴팁(기본: text) */
  title?: string;
}

/** 오버플로 진입/이탈 시 깜빡임으로 ResizeObserver ↔ setState 루프 방지 */
const OVERFLOW_HYSTERESIS_PX = 6;

/**
 * 좁은 폭에서 텍스트가 넘칠 때 무한 마퀴(끊김 없는 좌측 스크롤).
 * prefers-reduced-motion이면 애니메이션 없음.
 */
export const Moa_OverflowMarqueeText: React.FC<Moa_OverflowMarqueeTextProps> = ({
  text,
  className = '',
  wrapperClassName = '',
  title,
}) => {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const seg1Ref = useRef<HTMLSpanElement | null>(null);
  const gapRef = useRef<HTMLSpanElement | null>(null);
  const overflowsRef = useRef(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    overflowsRef.current = false;
    setOverflows(false);

    const outer = outerRef.current;
    if (!outer || typeof ResizeObserver === 'undefined') {
      return;
    }

    const measure = () => {
      const measureEl = measureRef.current;
      if (!measureEl) {
        return;
      }
      const wOuter = outer.clientWidth;
      /** 레이아웃 미확정(모바일 0폭 등)일 때 판정 스킵 — 오픈 직후 루프 방지 */
      if (wOuter < 2) {
        return;
      }

      const wText = measureEl.scrollWidth;
      let nextOverflow: boolean;
      if (!overflowsRef.current) {
        nextOverflow = wText > wOuter + OVERFLOW_HYSTERESIS_PX;
      } else {
        nextOverflow = wText > wOuter - OVERFLOW_HYSTERESIS_PX;
      }

      if (nextOverflow !== overflowsRef.current) {
        overflowsRef.current = nextOverflow;
        setOverflows(nextOverflow);
      }

      if (overflowsRef.current) {
        const seg1 = seg1Ref.current;
        const gap = gapRef.current;
        if (seg1 && gap) {
          const loopShift = seg1.offsetWidth + gap.offsetWidth;
          outer.style.setProperty('--moa-marquee-loop-shift', `${loopShift}px`);
          /** 한 주기 이동 거리당 목표 선속도 (px/s) — 텍스트 길이와 무관하게 동일 체감 속도 */
          const MARQUEE_PIXELS_PER_SECOND = 28;
          const rawSec = loopShift / MARQUEE_PIXELS_PER_SECOND;
          /** 초단 주기 방지 / 초장문으로 인한 과도한 대기 상한 */
          const SEC_MIN = 1.75;
          const SEC_MAX = 28;
          const sec = Math.min(SEC_MAX, Math.max(SEC_MIN, rawSec));
          outer.style.setProperty('--moa-marquee-cycle', `${sec.toFixed(2)}s`);
        }
      } else {
        outer.style.removeProperty('--moa-marquee-loop-shift');
        outer.style.removeProperty('--moa-marquee-cycle');
      }
    };

    measure();

    let rafId = 0;
    const scheduleMeasure = () => {
      if (rafId !== 0) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        measure();
      });
    };

    const ro = new ResizeObserver(scheduleMeasure);
    ro.observe(outer);
    const measureEl = measureRef.current;
    if (measureEl) {
      ro.observe(measureEl);
    }
    return () => {
      if (rafId !== 0) {
        cancelAnimationFrame(rafId);
      }
      ro.disconnect();
    };
  }, [text]);

  if (!text) {
    return null;
  }

  const rootClass = [
    'moa-overflow-marquee w-full min-w-0',
    overflows ? 'moa-overflow-marquee--active' : '',
    wrapperClassName,
  ]
    .filter(Boolean)
    .join(' ');

  const typoClass = ['moa-overflow-marquee__seg', className].filter(Boolean).join(' ');

  const ellipsisClass = [
    'moa-overflow-marquee__inner--ellipsis',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Div ref={outerRef} className={rootClass} title={title ?? text}>
      <Span
        ref={measureRef}
        className={`moa-overflow-marquee__measure ${className}`.trim()}
        aria-hidden
      >
        {text}
      </Span>
      {overflows ? (
        <Div className="moa-overflow-marquee__track">
          <Span ref={seg1Ref} className={typoClass}>
            {text}
          </Span>
          <Span ref={gapRef} className="moa-overflow-marquee__gap" aria-hidden />
          <Span className={typoClass} aria-hidden>
            {text}
          </Span>
        </Div>
      ) : (
        <Span className={ellipsisClass}>
          {text}
        </Span>
      )}
    </Div>
  );
};
