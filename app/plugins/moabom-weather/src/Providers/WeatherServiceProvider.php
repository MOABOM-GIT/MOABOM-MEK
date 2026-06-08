<?php

namespace Plugins\Moabom\Weather\Providers;

use Illuminate\Support\ServiceProvider;
use Plugins\Moabom\Weather\Contracts\IpGeolocationServiceInterface;
use Plugins\Moabom\Weather\Contracts\WeatherCurrentServiceInterface;
use Plugins\Moabom\Weather\Services\IpGeolocationService;
use Plugins\Moabom\Weather\Services\OpenMeteoClient;
use Plugins\Moabom\Weather\Services\WeatherCurrentService;

/**
 * moabom-weather 플러그인 서비스 프로바이더.
 *
 * 책임:
 *   1) `config/moabom-weather.php` 를 `moabom-weather` 키로 mergeConfigFrom.
 *   2) Open-Meteo / Geolocation 서비스 인터페이스 바인딩.
 *   3) `lang/{ko,en,ja,zh}/messages.php` 를 `moabom-weather::messages.*` 로 로드.
 *
 * 라우트는 `src/routes/api.php` 에 정의되어 코어 `PluginRouteServiceProvider`
 * 가 `/api/plugins/moabom-weather` prefix 로 자동 등록한다.
 */
class WeatherServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(
            dirname(__DIR__, 2).'/config/moabom-weather.php',
            'moabom-weather',
        );

        $this->app->singleton(OpenMeteoClient::class);
        $this->app->bind(WeatherCurrentServiceInterface::class, WeatherCurrentService::class);
        $this->app->bind(IpGeolocationServiceInterface::class, IpGeolocationService::class);
    }

    public function boot(): void
    {
        $langPath = dirname(__DIR__, 2).'/lang';
        if (is_dir($langPath)) {
            $this->loadTranslationsFrom($langPath, 'moabom-weather');
        }
    }
}
