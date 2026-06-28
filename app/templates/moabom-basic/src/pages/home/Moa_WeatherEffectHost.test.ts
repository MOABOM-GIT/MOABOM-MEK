import { describe, expect, it } from 'vitest';

import { isWeatherEffectHostActive } from '../../pages/home/Moa_WeatherEffectHost';

describe('isWeatherEffectHostActive', () => {
  it('is false when weather or animation is off', () => {
    expect(isWeatherEffectHostActive({ weather: false, animation: true })).toBe(false);
    expect(isWeatherEffectHostActive({ weather: true, animation: false })).toBe(false);
    expect(isWeatherEffectHostActive({ weather: false, animation: false })).toBe(false);
  });

  it('is true only when both weather and animation are on', () => {
    expect(isWeatherEffectHostActive({ weather: true, animation: true })).toBe(true);
  });
});
