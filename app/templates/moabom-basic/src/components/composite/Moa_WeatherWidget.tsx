import { useEffect, type ReactElement } from 'react';

import type { MoabomSystemDefaults } from '../../types/moabomSystem';
import { useEffectiveSystemOptions } from '../../runtime/useEffectiveSystemOptions';
import { Div } from '../basic/Div';

export interface MoaWeatherWidgetProps {
  /** 최상위에서 이미 페치한 관리자 기본값. `useEffectiveSystemOptions` 에 그대로 전달한다. */
  systemDefaults: MoabomSystemDefaults | null | undefined;
}

/**
 * 날씨 위젯 picket 컴포넌트.
 *
 * 본 스펙(`moabom-system-options-runtime-apply`) 범위에서는 Requirement 6 의
 * **"토글 훅 계약"** 만 구현하고, 실제 Geolocation / 외부 HTTP 페치는 별도 스펙에서
 * 다룬다(D1 결정). 여기서는 다음 계약을 보장한다:
 *
 * - `weather` Effective_Option_Value 가 `false` 이면 컴포넌트는 `null` 을 반환한다(Req 6.1).
 *   early-return 이 있는 렌더에서는 React 가 effect 본체 자체를 실행하지 않으므로,
 *   데이터 페치 로직이 추가된 이후에도 Req 6.2 의 "신규 페치 금지" 가 자연스럽게 충족된다.
 * - `weather` effective = `true` 이면 placeholder(`<Div data-testid="moa-weather-widget">`) 를
 *   렌더한다. 실제 UI 는 향후 별도 스펙에서 덮어쓴다.
 * - `useEffect` 본체 첫 줄의 `if (!effective.weather) return;` 가드는 향후 페치 로직
 *   추가 시 2 중 안전망 역할을 한다(Req 6.2 contract-lock).
 */
export function Moa_WeatherWidget({ systemDefaults }: MoaWeatherWidgetProps): ReactElement | null {
  const effective = useEffectiveSystemOptions({ systemDefaults });

  useEffect(() => {
    if (!effective.weather) return;
    // 향후 스펙에서 Geolocation 및 외부 날씨 API 호출을 여기에 추가한다.
    // 현재는 의도적으로 no-op.
  }, [effective.weather]);

  if (!effective.weather) return null;

  return (
    <Div data-testid="moa-weather-widget" className="moa-weather-widget">
      {'--'}
    </Div>
  );
}

export default Moa_WeatherWidget;
