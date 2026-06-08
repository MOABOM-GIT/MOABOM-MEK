<?php

namespace Plugins\Moabom\Weather\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Plugins\Moabom\Weather\Contracts\IpGeolocationServiceInterface;
use Throwable;

/**
 * D1-A 결정에 따른 IP geolocation 구현.
 *
 * 1순위: Cloudflare 요청 헤더(`CF-IPLatitude`/`CF-IPLongitude`/`CF-IPCountry`). 외부 호출 0회.
 * 2순위(`cloudflare_then_ipinfo`): `ipinfo.io` 호출. 실패해도 예외 대신 빈 결과를 반환한다.
 *
 * Req 7.9: 외부 실패·빈 결과를 포함한 모든 상태에서 컨트롤러는 200 OK 를 반환해야 하므로
 * 본 서비스는 `resolve()` 에서 절대 예외를 throw 하지 않는다.
 *
 * 결과는 `/24` 서브넷 + provider 조합을 캐시 키로 TTL 3600초 저장한다(Req 7.7).
 */
class IpGeolocationService implements IpGeolocationServiceInterface
{
    public function resolve(Request $request): array
    {
        $provider = (string) config('moabom-weather.ip_provider', 'cloudflare_then_ipinfo');

        if ($provider === 'disabled') {
            return [];
        }

        $ip = (string) $request->ip();
        $cacheKey = sprintf('moabom_weather_geolocate:%s:%s', $this->ipSubnet24($ip), $provider);

        return Cache::remember($cacheKey, 3600, function () use ($request, $provider, $ip) {
            if ($this->isNonRoutableIp($ip)) {
                $devFallback = $this->devFallbackLocation();
                if ($devFallback !== []) {
                    return $devFallback;
                }
            }

            // 1순위: Cloudflare 헤더
            $fromCloudflare = $this->resolveFromCloudflare($request);
            if ($fromCloudflare !== []) {
                return $fromCloudflare;
            }

            if ($provider === 'cloudflare_only') {
                return [];
            }

            // 2순위: ipinfo.io
            return $this->resolveFromIpinfo($request);
        });
    }

    /**
     * @return array{lat?:float, lon?:float, city?:string, country?:string}
     */
    private function devFallbackLocation(): array
    {
        $lat = config('moabom-weather.dev_fallback_lat');
        $lon = config('moabom-weather.dev_fallback_lon');

        if (! is_numeric($lat) || ! is_numeric($lon)) {
            return [];
        }

        $result = [
            'lat' => (float) $lat,
            'lon' => (float) $lon,
        ];

        $city = config('moabom-weather.dev_fallback_city');
        if (is_string($city) && $city !== '') {
            $result['city'] = $city;
        }

        $country = config('moabom-weather.dev_fallback_country');
        if (is_string($country) && $country !== '') {
            $result['country'] = $country;
        }

        return $result;
    }

    private function isNonRoutableIp(string $ip): bool
    {
        if ($ip === '' || $ip === '127.0.0.1' || $ip === '::1') {
            return true;
        }

        if (str_starts_with($ip, '169.254.')) {
            return true;
        }

        return filter_var(
            $ip,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE,
        ) === false;
    }

    /**
     * @return array{lat?:float, lon?:float, city?:string, country?:string}
     */
    private function resolveFromCloudflare(Request $request): array
    {
        $lat = $request->header('CF-IPLatitude');
        $lon = $request->header('CF-IPLongitude');

        if (! is_string($lat) || ! is_string($lon) || ! is_numeric($lat) || ! is_numeric($lon)) {
            return [];
        }

        $result = [
            'lat' => (float) $lat,
            'lon' => (float) $lon,
        ];

        $country = $request->header('CF-IPCountry');
        if (is_string($country) && $country !== '') {
            $result['country'] = $country;
        }

        $city = $request->header('CF-IPCity');
        if (is_string($city) && $city !== '') {
            $result['city'] = $city;
        }

        return $result;
    }

    /**
     * @return array{lat?:float, lon?:float, city?:string, country?:string}
     */
    private function resolveFromIpinfo(Request $request): array
    {
        $ip = (string) $request->ip();
        if ($ip === '') {
            return [];
        }

        $token = config('moabom-weather.ipinfo_token');
        $url = sprintf('https://ipinfo.io/%s/json', rawurlencode($ip));

        try {
            $pending = Http::timeout(3)->retry(1, 200);
            if (is_string($token) && $token !== '') {
                $pending = $pending->withToken($token);
            }

            $response = $pending->get($url);
        } catch (Throwable) {
            return [];
        }

        if (! $response->ok()) {
            return [];
        }

        $json = $response->json() ?? [];

        // ipinfo 의 `loc` 필드는 "lat,lon" 문자열.
        $loc = $json['loc'] ?? null;
        if (! is_string($loc) || ! str_contains($loc, ',')) {
            return [];
        }

        [$latRaw, $lonRaw] = array_pad(explode(',', $loc, 2), 2, null);
        if (! is_numeric($latRaw) || ! is_numeric($lonRaw)) {
            return [];
        }

        $result = [
            'lat' => (float) $latRaw,
            'lon' => (float) $lonRaw,
        ];

        $city = $json['city'] ?? null;
        if (is_string($city) && $city !== '') {
            $result['city'] = $city;
        }

        $country = $json['country'] ?? null;
        if (is_string($country) && $country !== '') {
            $result['country'] = $country;
        }

        return $result;
    }

    /**
     * IP 를 `/24` 서브넷 문자열로 정규화해 캐시 키를 구성한다.
     * IPv4: "a.b.c.0", IPv6 및 파싱 실패 시 원본을 그대로 사용한다.
     */
    private function ipSubnet24(string $ip): string
    {
        if ($ip === '') {
            return 'unknown';
        }

        $parts = explode('.', $ip);
        if (count($parts) === 4 && ctype_digit($parts[0]) && ctype_digit($parts[1]) && ctype_digit($parts[2])) {
            return sprintf('%s.%s.%s.0', $parts[0], $parts[1], $parts[2]);
        }

        return $ip;
    }
}
