<?php

declare(strict_types=1);

namespace App\Providers;

use Illuminate\Filesystem\FilesystemManager;
use Illuminate\Support\Facades\Storage;
use League\Flysystem\Filesystem as Flysystem;
use Spatie\GoogleCloudStorage\GoogleCloudStorageAdapter;
use Spatie\GoogleCloudStorage\GoogleCloudStorageServiceProvider;

/**
 * Spatie GCS 드라이버는 기본이 boot() 등록이라 SettingsServiceProvider::register()
 * 가 settings 디스크(gcs)를 읽을 때 "Driver [gcs] is not supported" 가 난다 (RF-28).
 *
 * register() 에서 즉시 extend 하고, FilesystemManager resolving 시에도 재적용해
 * 매니저 재생성·부트 순서 편차에도 드라이버가 유지되게 한다.
 */
class EarlyGoogleCloudStorageServiceProvider extends GoogleCloudStorageServiceProvider
{
    public function register(): void
    {
        $this->extendGcsDriver();

        $this->app->resolving(FilesystemManager::class, function (): void {
            $this->extendGcsDriver();
        });
    }

    public function boot(): void
    {
        // register()/resolving 에서 이미 등록 — Spatie 기본 boot() 중복 방지
    }

    private function extendGcsDriver(): void
    {
        if (! $this->app->bound('filesystem')) {
            return;
        }

        $provider = $this;
        Storage::extend('gcs', static function ($_app, $config) use ($provider) {
            $config = $provider->prepareConfig($config);
            $client = $provider->createClient($config);
            $adapter = $provider->createAdapter($client, $config);

            return new GoogleCloudStorageAdapter(
                new Flysystem($adapter, $config),
                $adapter,
                $config,
                $client,
            );
        });
    }
}
