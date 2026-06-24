import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { Div } from '../basic/Div';
import { Button } from '../basic/Button';
import { Icon } from '../basic/Icon';
import { Span } from '../basic/Span';
import { useMoabomShellT } from '../../i18n/MoabomUiI18nProvider';
import { truncateShellWindowTitle } from '../../utils/truncateShellWindowTitle';

/** 뷰포트 안에 창 위치 클램프 */
function clampWindowPosition(x: number, y: number, w: number, h: number): { x: number; y: number } {
  const maxX = Math.max(0, window.innerWidth - w);
  const maxY = Math.max(0, window.innerHeight - h);
  return { x: Math.max(0, Math.min(x, maxX)), y: Math.max(0, Math.min(y, maxY)) };
}

export interface WindowProps {
  id: string;
  title: string;
  icon?: string;
  /** 타이틀 바 배경 — 앱 아이콘·태스크바 버튼과 동일한 CSS `linear-gradient(...)`. 미지정 시 `--moa-point-color`. */
  gradient?: string;
  isFavorite?: boolean;
  initialX?: number;
  initialY?: number;
  initialWidth?: number;
  initialHeight?: number;
  minWidth?: number;
  minHeight?: number;
  isMaximized?: boolean;
  isMinimized?: boolean;
  zIndex?: number;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onToggleFavorite?: () => void;
  onFocus?: () => void;
  children?: React.ReactNode;
  className?: string;
  compact?: boolean;
  /** PC 등에서 한 번 높이에 맞춤(ResizeObserver 미사용). 사용자가 코너로 리사이즈하면 자동 맞춤 종료 */
  fitContent?: boolean;
  /** fitContent 시 창 고정 폭(px). 내용 폭 순환 때문에 높이만 자동 계산합니다. */
  fitContentWidth?: number;
  /** 로그인↔회원가입처럼 같은 창 안에서 높이를 다시 맞출 때 */
  fitContentRemeasureKey?: string;
  /** AI 앱 만들기(create-app) 창 전용 타이틀 크롬 */
  titleBarVariant?: 'default' | 'create-app';
  /** `titleBarVariant === 'create-app'` 일 때 회전 테두리용 CSS 변수 */
  titleBarExtraStyle?: React.CSSProperties;
}

export const Window: React.FC<WindowProps> = ({
  id,
  title,
  icon,
  gradient,
  initialX,
  initialY,
  isFavorite = false,
  initialWidth = 1280,
  initialHeight = 800,
  minWidth = 400,
  minHeight = 300,
  isMaximized: initialMaximized = false,
  isMinimized: initialMinimized = false,
  zIndex = 1000,
  onClose,
  onMinimize,
  onMaximize,
  onToggleFavorite,
  onFocus,
  children,
  className = '',
  compact = false,
  fitContent = false,
  fitContentWidth,
  fitContentRemeasureKey,
  titleBarVariant = 'default',
  titleBarExtraStyle,
}) => {
  const { t } = useMoabomShellT();
  const getInitialPosition = (width: number, height: number) => {
    if (typeof initialX === 'number' || typeof initialY === 'number') {
      return clampWindowPosition(
        typeof initialX === 'number' ? initialX : Math.max(0, (window.innerWidth - width) / 2),
        typeof initialY === 'number' ? initialY : Math.max(0, (window.innerHeight - height) / 2),
        width,
        height,
      );
    }

    return {
      x: Math.max(0, (window.innerWidth - width) / 2),
      y: Math.max(0, (window.innerHeight - height) / 2),
    };
  };

  const getDefaultFrame = () => {
    const nextWidth = Math.min(initialWidth, Math.max(minWidth, window.innerWidth - 40));
    const nextHeight = Math.min(initialHeight, Math.max(minHeight, window.innerHeight - 40));

    return {
      position: getInitialPosition(nextWidth, nextHeight),
      size: {
        width: nextWidth,
        height: nextHeight,
      },
    };
  };

  // 전달된 좌표가 있으면 해당 위치, 없으면 화면 정가운데로 초기 위치 계산
  const initialFrame = getDefaultFrame();
  const [position, setPosition] = useState(initialFrame.position);
  const [size, setSize] = useState(initialFrame.size);
  const [isMaximized, setIsMaximized] = useState(initialMaximized);
  const [isMinimized, setIsMinimized] = useState(initialMinimized);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const windowRef = useRef<HTMLDivElement>(null);
  const titleBarRef = useRef<HTMLDivElement>(null);
  const fitMeasureRef = useRef<HTMLDivElement>(null);
  /** 사용자가 코너 드래그 중에는 높이 자동 재조정 무시 → 창 크기 변경과 ResizeObserver 간섭 방지 */
  const resizingPointerActiveRef = useRef(false);
  /** 사용자가 코너 리사이즈 후에는 콘텐츠 맞춤(높이 재계산) 정지 */
  const contentFitManualLockRef = useRef(false);
  const sizeSyncRef = useRef(initialFrame.size);
  const fitContentRef = useRef(fitContent);
  const compactRef = useRef(compact);
  const positionViewportRef = useRef(initialFrame.position);
  const sizeViewportRef = useRef(initialFrame.size);
  const [titleBarWidth, setTitleBarWidth] = useState(initialFrame.size.width);

  useLayoutEffect(() => {
    const node = titleBarRef.current;
    if (!node) {
      return undefined;
    }
    const update = () => setTitleBarWidth(node.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [isMaximized, compact, size.width]);

  const displayTitle = useMemo(
    () => truncateShellWindowTitle(title, titleBarWidth),
    [title, titleBarWidth],
  );

  useEffect(() => {
    fitContentRef.current = fitContent;
    compactRef.current = compact;
    sizeSyncRef.current = size;
    positionViewportRef.current = position;
    sizeViewportRef.current = size;
  }, [fitContent, compact, size, position]);

  /** fitContent 전용(로그인 등)이 아닌 일반 창: 브라우저 창을 줄이면 창 크기·위치를 뷰포트 안으로 맞춤 */
  useEffect(() => {
    if (compact || fitContent || isMaximized || isMinimized) {
      return undefined;
    }

    const syncViewport = () => {
      const maxW = Math.max(minWidth, window.innerWidth - 40);
      const maxH = Math.max(minHeight, window.innerHeight - 40);
      const w = Math.min(sizeViewportRef.current.width, maxW);
      const h = Math.min(sizeViewportRef.current.height, maxH);
      const nextPos = clampWindowPosition(positionViewportRef.current.x, positionViewportRef.current.y, w, h);
      positionViewportRef.current = nextPos;
      sizeViewportRef.current = { width: w, height: h };
      setSize({ width: w, height: h });
      setPosition(nextPos);
    };

    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, [compact, fitContent, isMaximized, isMinimized, minHeight, minWidth]);

  const wasCompactRef = useRef(compact);
  const compactRestorePendingRef = useRef(false);

  // props 변경 감지하여 내부 state 동기화
  useEffect(() => {
    setIsMinimized(initialMinimized);
  }, [initialMinimized]);

  useEffect(() => {
    setIsMaximized(initialMaximized);
  }, [initialMaximized]);

  useEffect(() => {
    if (compact) {
      wasCompactRef.current = true;
      compactRestorePendingRef.current = true;
      setPosition({ x: 10, y: 10 });
      setSize({ width: Math.max(0, window.innerWidth - 20), height: Math.max(0, window.innerHeight - 20) });
      return;
    }

    if (wasCompactRef.current) {
      wasCompactRef.current = false;
      if (fitContent) {
        compactRestorePendingRef.current = false;
      } else {
        const nextFrame = getDefaultFrame();
        setPosition(nextFrame.position);
        setSize(nextFrame.size);
        compactRestorePendingRef.current = nextFrame.size.width < initialWidth || nextFrame.size.height < initialHeight;
      }
    }
  }, [compact, fitContent, initialHeight, initialWidth, initialX, initialY, minHeight, minWidth]);

  useEffect(() => {
    if (compact || fitContent || !compactRestorePendingRef.current) return;

    const restoreDefaultFrame = () => {
      if (!compactRestorePendingRef.current) return;
      const nextFrame = getDefaultFrame();
      setPosition(nextFrame.position);
      setSize(nextFrame.size);
      compactRestorePendingRef.current = nextFrame.size.width < initialWidth || nextFrame.size.height < initialHeight;
    };

    window.addEventListener('resize', restoreDefaultFrame);
    restoreDefaultFrame();

    return () => window.removeEventListener('resize', restoreDefaultFrame);
  }, [compact, fitContent, initialHeight, initialWidth, initialX, initialY, minHeight, minWidth]);

  /** 새 창·인증 탭 변경 시 사용자 리사이즈 잠금 해제 후 다시 맞춤 */
  useLayoutEffect(() => {
    contentFitManualLockRef.current = false;
  }, [id, fitContentRemeasureKey ?? '__none__']);

  /** 최대화 해제 시 다시 내용 높이에 자동 맞춤 허용 */
  useLayoutEffect(() => {
    if (!isMaximized && fitContent && !compact) {
      contentFitManualLockRef.current = false;
    }
  }, [isMaximized, fitContent, compact]);

  /** fitContent: 초기 측정 + ResizeObserver로 지연 렌더(소셜 버튼 등) 반영 — 코너 리사이즈 중·수동 잠금 시 무시 */
  useLayoutEffect(() => {
    if (!fitContent || compact || isMaximized) return;

    let rafOuter = 0;
    let rafInner = 0;
    let cancelled = false;

    const BODY_EDGE_SIDE = 20;
    const BODY_EDGE_BOTTOM = 20;
    /** 글래스 보더·서브픽셀·폰트 로드 후 미세 줄바꿈 대비 */
    const ROUND_SLACK = 14;

    const applyMeasurements = (): void => {
      if (cancelled || contentFitManualLockRef.current) return;

      const measureRoot = fitMeasureRef.current;
      const titleBar = titleBarRef.current;
      if (!measureRoot || !titleBar) return;

      const titleH = Math.ceil(titleBar.offsetHeight);
      const rectH = Math.ceil(measureRoot.getBoundingClientRect().height);
      const contentH = Math.ceil(Math.max(measureRoot.scrollHeight, measureRoot.offsetHeight, rectH));
      const nominalContentW = fitContentWidth ?? 440;

      const targetW = Math.min(
        window.innerWidth - 40,
        Math.max(minWidth, nominalContentW + BODY_EDGE_SIDE * 2),
      );
      const targetH = Math.min(
        window.innerHeight - 40,
        Math.max(minHeight, titleH + contentH + BODY_EDGE_BOTTOM + ROUND_SLACK),
      );

      setSize(prev => (
        prev.width === targetW && prev.height === targetH ? prev : { width: targetW, height: targetH }
      ));
      setPosition(getInitialPosition(targetW, targetH));
    };

    const queueTwoFrameFit = (): void => {
      if (cancelled || contentFitManualLockRef.current) return;
      cancelAnimationFrame(rafOuter);
      cancelAnimationFrame(rafInner);
      rafOuter = requestAnimationFrame(() => {
        if (cancelled) return;
        applyMeasurements();
        rafInner = requestAnimationFrame(() => {
          if (cancelled) return;
          applyMeasurements();
        });
      });
    };

    queueTwoFrameFit();

    const fitMeasureEl = fitMeasureRef.current;
    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined' && fitMeasureEl) {
      resizeObserver = new ResizeObserver(() => {
        if (cancelled || contentFitManualLockRef.current || resizingPointerActiveRef.current) return;
        queueTwoFrameFit();
      });
      resizeObserver.observe(fitMeasureEl);
    }

    const handleViewportResize = (): void => {
      if (!fitContent || compact) return;

      const { width: cw, height: ch } = sizeSyncRef.current;

      if (contentFitManualLockRef.current) {
        setPosition(prev => clampWindowPosition(prev.x, prev.y, cw, ch));
        return;
      }
      queueTwoFrameFit();
    };

    window.addEventListener('resize', handleViewportResize);

    return (): void => {
      cancelled = true;
      cancelAnimationFrame(rafOuter);
      cancelAnimationFrame(rafInner);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleViewportResize);
    };
  }, [compact, fitContent, fitContentRemeasureKey, fitContentWidth, id, initialX, initialY, isMaximized, minHeight, minWidth]);

  const handlePointerDownDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isMaximized || compact) return;
    compactRestorePendingRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    if (onFocus) onFocus();
  };

  const handlePointerDownResize = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isMaximized || compact) return;
    compactRestorePendingRef.current = false;
    resizingPointerActiveRef.current = true;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsResizing(true);
    setResizeStart({ x: e.clientX, y: e.clientY, width: size.width, height: size.height });
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;
        const halfW = size.width / 2;
        const halfH = size.height / 2;

        setPosition({
          // 좌우: 창 정가운데까지만 화면 밖으로 나갈 수 있음
          x: Math.max(-halfW, Math.min(newX, window.innerWidth - halfW)),
          // 상단: 타이틀바가 화면 밖으로 나가지 않음 (y >= 0)
          // 하단: 창 정가운데까지만
          y: Math.max(0, Math.min(newY, window.innerHeight - halfH)),
        });
      }
      if (isResizing) {
        setSize({
          width: Math.min(window.innerWidth, Math.max(minWidth, resizeStart.width + (e.clientX - resizeStart.x))),
          height: Math.min(window.innerHeight, Math.max(minHeight, resizeStart.height + (e.clientY - resizeStart.y))),
        });
      }
    };
    const handlePointerEnd = () => {
      resizingPointerActiveRef.current = false;
      if (isResizing && fitContentRef.current && !compactRef.current) {
        contentFitManualLockRef.current = true;
      }
      setIsDragging(false);
      setIsResizing(false);
    };
    if (isDragging || isResizing) {
      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerEnd);
      document.addEventListener('pointercancel', handlePointerEnd);
      return () => {
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerEnd);
        document.removeEventListener('pointercancel', handlePointerEnd);
      };
    }
  }, [isDragging, isResizing, dragStart, resizeStart, minWidth, minHeight, size.width, size.height]);

  if (isMinimized) return null;

  /** 뷰포트에 맞춤(최대화)일 때 모서리 반경 0 — 데스크톱·모바일(compact) 공통 */
  const isEdgeToEdge = isMaximized;

  const containerStyle: React.CSSProperties = compact
    ? isMaximized
      ? { position: 'fixed', inset: 0, width: '100vw', height: '100dvh', zIndex, resize: 'none' }
      : { position: 'fixed', left: 10, top: 10, width: 'calc(100vw - 20px)', height: 'calc(100dvh - 20px)', zIndex, resize: 'none' }
    : isMaximized
    ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', zIndex }
    : { position: 'fixed', left: position.x, top: position.y, width: size.width, height: size.height, zIndex };

  return (
    <Div
      ref={windowRef}
      data-window-id={id}
      className={`${isDragging ? 'cursor-move' : ''} ${className}`.trim()}
      style={containerStyle}
      onClick={() => onFocus && onFocus()}
    >
      <Div
        className={`moa-window-frame absolute inset-0 flex flex-col h-full w-full min-h-0 ${
          isEdgeToEdge ? 'moa-window-frame--maximized rounded-none' : 'rounded-2xl'
        } ${titleBarVariant === 'create-app' ? 'overflow-visible' : 'overflow-hidden'}`}
      >
        {/* 타이틀 바 */}
        {titleBarVariant === 'create-app' ? (
          <Div
            ref={titleBarRef}
            data-window-title-bar
            className={`moa-window-title-bar-create shrink-0 cursor-move select-none ${isEdgeToEdge ? 'rounded-none' : 'rounded-2xl'}`}
            style={titleBarExtraStyle}
            onPointerDown={handlePointerDownDrag}
          >
            <Div
              className={`moa-window-title-bar-create__inner flex items-center justify-between px-4 py-2.5 ${
                isEdgeToEdge ? 'rounded-none' : 'rounded-[14px]'
              }`}
            >
              <Div className="flex min-w-0 flex-1 items-center gap-2">
                {icon ? <Icon name={icon} className="shrink-0 text-base text-white drop-shadow-sm" /> : null}
                <Span className="min-w-0 truncate text-base font-bold text-white drop-shadow-sm" title={title}>
                  {displayTitle}
                </Span>
              </Div>
              <Div className="flex shrink-0 items-center gap-1.5" onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => e.stopPropagation()}>
                <Button
                  type="button"
                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); if (onMinimize) onMinimize(); }}
                  className="moa-window-chrome-btn cursor-pointer rounded-full border-0 bg-white/20 transition-all hover:bg-white/35"
                >
                  <Icon name="minus" className="moa-window-chrome-icon-slot text-white" />
                </Button>
                <Button
                  type="button"
                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); setIsMaximized(!isMaximized); if (onMaximize) onMaximize(); }}
                  className="moa-window-chrome-btn cursor-pointer rounded-full border-0 bg-white/20 transition-all hover:bg-white/35"
                >
                  <Icon name={isMaximized ? 'compress' : 'expand'} className="moa-window-chrome-icon-slot text-white" />
                </Button>
                <Button
                  type="button"
                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); if (onClose) onClose(); }}
                  className="moa-window-chrome-btn cursor-pointer rounded-full border-0 bg-red-400/80 transition-all hover:bg-red-500"
                >
                  <Icon name="times" className="moa-window-chrome-icon-slot text-white" />
                </Button>
              </Div>
            </Div>
          </Div>
        ) : (
          <Div
            ref={titleBarRef}
            data-window-title-bar
            className={`flex shrink-0 cursor-move select-none items-center justify-between px-4 py-3 ${isEdgeToEdge ? 'rounded-none' : 'rounded-2xl'}`}
            style={{ background: gradient ?? 'var(--moa-point-color)' }}
            onPointerDown={handlePointerDownDrag}
          >
            <Div className="flex min-w-0 flex-1 items-center gap-2">
              {icon && <Icon name={icon} className="shrink-0 text-base text-white" />}
              <Span className="min-w-0 truncate text-base font-bold text-white" title={title}>
                {displayTitle}
              </Span>
              {onToggleFavorite && (
                <Button
                  type="button"
                  onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
                  onPointerDown={(e: React.PointerEvent<HTMLButtonElement>) => e.stopPropagation()}
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    onToggleFavorite();
                  }}
                  className={`flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 transition-all ${
                    isFavorite
                      ? 'bg-amber-400/90 hover:bg-amber-400'
                      : 'bg-white/20 hover:bg-white/35'
                  }`}
                  title={isFavorite ? t('moa_shell.window.favorite_remove') : t('moa_shell.window.favorite_add')}
                  aria-label={isFavorite ? t('moa_shell.window.favorite_remove') : t('moa_shell.window.favorite_add')}
                >
                  <Icon name="star" className="text-xs text-white" />
                </Button>
              )}
            </Div>
            <Div className="flex items-center gap-1.5" onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => e.stopPropagation()}>
              <Button
                type="button"
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); if (onMinimize) onMinimize(); }}
                className="moa-window-chrome-btn cursor-pointer rounded-full border-0 bg-white/20 transition-all hover:bg-white/35"
              >
                <Icon name="minus" className="moa-window-chrome-icon-slot text-white" />
              </Button>
              <Button
                type="button"
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); setIsMaximized(!isMaximized); if (onMaximize) onMaximize(); }}
                className="moa-window-chrome-btn cursor-pointer rounded-full border-0 bg-white/20 transition-all hover:bg-white/35"
              >
                <Icon name={isMaximized ? 'compress' : 'expand'} className="moa-window-chrome-icon-slot text-white" />
              </Button>
              <Button
                type="button"
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); if (onClose) onClose(); }}
                className="moa-window-chrome-btn cursor-pointer rounded-full border-0 bg-red-400/80 transition-all hover:bg-red-500"
              >
                <Icon name="times" className="moa-window-chrome-icon-slot text-white" />
              </Button>
            </Div>
          </Div>
        )}

        {/* 창 내용 — 스크롤 책임은 이 한 겹만 가진다. */}
        {fitContent && !compact ? (
          <Div className="moa-app-window-viewport">
            <Div ref={fitMeasureRef} className="w-full shrink-0">
              {children}
            </Div>
          </Div>
        ) : (
          <Div className="moa-app-window-viewport">{children}</Div>
        )}

        {/* 리사이즈 핸들 */}
        {!isMaximized && !compact && (
          <Div
            className="absolute bottom-1 right-1 w-4 h-4 cursor-se-resize z-10 flex items-center justify-center opacity-40 hover:opacity-80 transition-opacity"
            onPointerDown={handlePointerDownResize}
          >
            <Icon name="grip-lines" className="text-muted text-xxs rotate-[-45deg]" />
          </Div>
        )}
      </Div>
    </Div>
  );
};
