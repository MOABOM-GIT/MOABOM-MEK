<?php

namespace Plugins\Moabom\Weather\Exceptions;

use RuntimeException;

/**
 * Open-Meteo 등 외부 업스트림 서비스가 일시적으로 응답할 수 없는 상태를 나타낸다.
 *
 * `WeatherCurrentService::fetch` 가 `Cache::remember` 내부에서 이 예외를 throw 하면
 * `Cache::remember` 는 값을 캐시하지 않으므로 Req 7.13("실패 응답 캐시 금지")
 * 이 자연스럽게 충족된다. 컨트롤러는 이 예외를 `503 Service Unavailable` 로 매핑한다.
 */
class UpstreamUnavailableException extends RuntimeException {}
