<?php

declare(strict_types=1);

namespace Plugins\Moabom\Fcm\Providers;

use App\Extension\HookManager;
use Illuminate\Support\ServiceProvider;
use Plugins\Moabom\Fcm\Contracts\FcmClientInterface;
use Plugins\Moabom\Fcm\DTO\FcmMessage;
use Plugins\Moabom\Fcm\Services\FcmPushService;
use Plugins\Moabom\Fcm\Services\GoogleFcmV1Client;
use Plugins\Moabom\Fcm\Services\NullFcmClient;

class FcmServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(
            dirname(__DIR__, 2).'/config/moabom-fcm.php',
            'moabom-fcm',
        );

        $this->app->singleton(FcmClientInterface::class, function (): FcmClientInterface {
            $driver = (string) config('moabom-fcm.driver', 'null');
            if ($driver === 'google') {
                return new GoogleFcmV1Client(
                    config('moabom-fcm.project_id'),
                    config('moabom-fcm.service_account_json'),
                );
            }

            return new NullFcmClient();
        });

        $this->app->singleton(FcmPushService::class);
    }

    public function boot(): void
    {
        HookManager::addFilter('moabom.fcm.status', function (array $status): array {
            /** @var FcmClientInterface $client */
            $client = $this->app->make(FcmClientInterface::class);

            return [
                'enabled' => (bool) config('moabom-fcm.enabled', false),
                'configured' => $client->isConfigured(),
                'driver' => (string) config('moabom-fcm.driver', 'null'),
                'project_id' => config('moabom-fcm.project_id'),
            ];
        });

        HookManager::addAction('moabom.fcm.send', function (FcmMessage $message): void {
            /** @var FcmPushService $push */
            $push = $this->app->make(FcmPushService::class);
            $push->send($message);
        });
    }
}
