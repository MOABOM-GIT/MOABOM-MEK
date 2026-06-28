import React, { useEffect, useRef } from 'react';

import { Canvas } from '../../components/basic/Canvas';
import type { MoabomSystemDefaults } from '../../types/moabomSystem';
import type { EffectiveSystemOptions } from '../../runtime/types';
import { useWeatherEffectRuntime } from '../../runtime/weather/useWeatherEffectRuntime';

export interface Moa_WeatherEffectHostInnerProps {
  effective: Pick<EffectiveSystemOptions, 'weather' | 'animation'>;
  systemDefaults: MoabomSystemDefaults | null | undefined;
}

/**
 * 날씨 Canvas + `useWeatherEffectRuntime` — dynamic import 대상(무거운 청크).
 *
 * 호스트(`Moa_WeatherEffectHost`)가 effective.weather·animation 이 모두 true 일 때만 마운트된다.
 */
export const Moa_WeatherEffectHostInner: React.FC<Moa_WeatherEffectHostInnerProps> = ({
  effective,
  systemDefaults,
}) => {
  const weatherCanvasRef = useRef<HTMLCanvasElement>(null);

  useWeatherEffectRuntime({
    canvasRef: weatherCanvasRef,
    effective,
    systemDefaults,
  });

  useEffect(() => {
    const resizeWeatherCanvas = (): void => {
      const canvas = weatherCanvasRef.current;
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeWeatherCanvas();
    window.addEventListener('resize', resizeWeatherCanvas);
    return () => window.removeEventListener('resize', resizeWeatherCanvas);
  }, []);

  return (
    <Canvas
      ref={weatherCanvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
};
