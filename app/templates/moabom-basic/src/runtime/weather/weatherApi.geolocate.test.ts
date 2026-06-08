import { afterEach, describe, expect, it, vi } from 'vitest';

import { __resetWeatherGeolocateInflightForTest, fetchWeatherGeolocate } from './weatherApi';

describe('fetchWeatherGeolocate', () => {
  afterEach(() => {
    __resetWeatherGeolocateInflightForTest();
    vi.unstubAllGlobals();
  });

  it('treats empty array data as empty geolocate result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    }));

    const result = await fetchWeatherGeolocate();
    expect(result.kind).toBe('empty');
  });

  it('dedupes concurrent geolocate requests into one fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { lat: 37.5, lon: 127.0, city: 'Seoul', country: 'KR' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const [a, b] = await Promise.all([fetchWeatherGeolocate(), fetchWeatherGeolocate()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.kind).toBe('ok');
    expect(b.kind).toBe('ok');
  });
});
