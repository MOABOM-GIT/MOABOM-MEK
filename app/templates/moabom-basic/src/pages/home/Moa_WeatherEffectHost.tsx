import React, { Suspense, useMemo } from 'react';

import type { MoabomSystemDefaults } from '../../types/moabomSystem';
import type { EffectiveSystemOptions } from '../../runtime/types';

const WeatherEffectHostInnerLazy = React.lazy(async () => {
  const m = await import('./Moa_WeatherEffectHostInner');
  return { default: m.Moa_WeatherEffectHostInner };
});

export interface Moa_WeatherEffectHostProps {
  effective: Pick<EffectiveSystemOptions, 'weather' | 'animation'>;
  systemDefaults: MoabomSystemDefaults | null | undefined;
}

/** 날씨 효과를 켤 조건 — `shouldRender` 의 effective 절과 동일. */
export function isWeatherEffectHostActive(
  effective: Pick<EffectiveSystemOptions, 'weather' | 'animation'>,
): boolean {
  return effective.weather === true && effective.animation === true;
}

/**
 * 날씨 OFF 시 null — Canvas·엔진 청크·런타임 훅을 전혀 마운트하지 않는다.
 * ON 시 Suspense + lazy 로 순차 로드하며, fallback 은 비어 있어 셸 UI 를 막지 않는다.
 */
export const Moa_WeatherEffectHost: React.FC<Moa_WeatherEffectHostProps> = ({
  effective,
  systemDefaults,
}) => {
  const active = useMemo(
    () => isWeatherEffectHostActive(effective),
    [effective.weather, effective.animation],
  );

  if (!active) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <WeatherEffectHostInnerLazy
        effective={effective}
        systemDefaults={systemDefaults}
      />
    </Suspense>
  );
};
