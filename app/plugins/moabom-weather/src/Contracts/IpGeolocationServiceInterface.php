<?php

namespace Plugins\Moabom\Weather\Contracts;

use Illuminate\Http\Request;

/**
 * Weather_Geolocate_API (`GET /weather/geolocate`) 의 도메인 서비스 계약.
 *
 * 구현체(`IpGeolocationService`) 는 D1-A 결정에 따라:
 * 1순위 Cloudflare 요청 헤더(`CF-IPLatitude`/`CF-IPLongitude`/`CF-IPCountry`),
 * 2순위 ipinfo.io HTTP 호출(토큰은 `config('moabom-weather.ipinfo_token')`)
 * 를 차례로 시도한다. 외부 호출·헤더 모두 실패해도 예외를 throw 하지 않고 빈 결과를 반환한다(Req 7.9).
 */
interface IpGeolocationServiceInterface
{
    /**
     * 요청 IP 기반으로 대략적 위치를 추정한다.
     *
     * @return array{lat?:float, lon?:float, city?:string, country?:string}
     *                                                                      위치를 추정할 수 없으면 빈 배열 `[]` 를 반환한다. 컨트롤러는 이를
     *                                                                      Req 7.9 에 따라 `{ "data": {} }` · 200 OK 로 응답한다.
     */
    public function resolve(Request $request): array;
}
