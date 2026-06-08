import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Div } from '../../components/basic/Div';

/**
 * 전자서명 캔버스 (터치/펜/마우스) — 앱 공용 컴포넌트 (SSOT).
 *
 * 부모는 ref 로 서명 이미지(dataURL)·비움 여부를 읽고 지운다.
 *   const padRef = useRef<SignaturePadHandle>(null);
 *   <SignaturePad ref={padRef} onSignatureChange={setHasSig} />
 *   padRef.current?.toDataURL();  padRef.current?.clear();
 */
export interface SignaturePadHandle {
  toDataURL: (type?: string) => string | null;
  clear: () => void;
  isEmpty: () => boolean;
}

interface SignaturePadProps {
  width?: number;
  height?: number;
  placeholder?: string;
  className?: string;
  strokeColor?: string;
  lineWidth?: number;
  /** 첫 획/지움 시 호출 — 부모가 "서명됨" 상태를 추적할 때. */
  onSignatureChange?: (hasSignature: boolean) => void;
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(function SignaturePad(
  {
    width = 640,
    height = 220,
    placeholder = '(이곳에 서명하세요)',
    className = 'h-[220px] w-full touch-none bg-white',
    strokeColor = '#0f172a',
    lineWidth = 2.5,
    onSignatureChange,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [hasSignature, setHasSignature] = useState(false);

  const updateHas = useCallback(
    (v: boolean) => {
      setHasSignature(v);
      onSignatureChange?.(v);
    },
    [onSignatureChange],
  );

  const resetCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    updateHas(false);
  }, [updateHas]);

  useEffect(() => {
    resetCanvas();
  }, [resetCanvas]);

  useImperativeHandle(
    ref,
    () => ({
      toDataURL: (type = 'image/png') => canvasRef.current?.toDataURL(type) ?? null,
      clear: resetCanvas,
      isEmpty: () => !hasSignature,
    }),
    [resetCanvas, hasSignature],
  );

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    drawingRef.current = true;
    lastRef.current = pointerPos(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const pos = pointerPos(e);
    const last = lastRef.current ?? pos;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastRef.current = pos;
    if (!hasSignature) updateHas(true);
  };

  const endDraw = () => {
    drawingRef.current = false;
    lastRef.current = null;
  };

  return (
    <Div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-blue-300 dark:border-blue-500/40">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={className}
        onPointerDown={startDraw}
        onPointerMove={moveDraw}
        onPointerUp={endDraw}
        onPointerLeave={endDraw}
        onPointerCancel={endDraw}
      />
      {!hasSignature && (
        <Div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-300">
          {placeholder}
        </Div>
      )}
    </Div>
  );
});
