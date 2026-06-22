<?php

declare(strict_types=1);

namespace Plugins\Moabom\Reverb\Providers;

use App\Extension\HookManager;
use Illuminate\Support\ServiceProvider;
use Plugins\Moabom\Reverb\ReverbDriversDefaults;
use Plugins\Moabom\Reverb\WebsocketDriverConfigApplier;

/**
 * moabom-reverb — moabom-system SaaS hydrator/seeder 와 Hook 으로만 연결.
 */
class ReverbServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(
            dirname(__DIR__, 2).'/config/moabom-reverb.php',
            'moabom-reverb',
        );
    }

    public function boot(): void
    {
        HookManager::addFilter(
            'moabom.saas.drivers.seed_defaults',
            function (array $drivers, string $clientHost): array {
                return ReverbDriversDefaults::mergeInto($drivers, $clientHost);
            },
        );

        HookManager::addAction(
            'moabom.saas.drivers.apply_runtime',
            function (array $drivers): void {
                WebsocketDriverConfigApplier::apply($drivers);
            },
        );
    }
}
