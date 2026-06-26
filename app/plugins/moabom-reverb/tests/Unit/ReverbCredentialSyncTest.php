<?php

declare(strict_types=1);

namespace Plugins\Moabom\Reverb\Tests\Unit;

use Illuminate\Support\Facades\Config;
use Plugins\Moabom\Reverb\ReverbCredentialSync;
use Plugins\Moabom\Reverb\Tests\PluginTestCase;

final class ReverbCredentialSyncTest extends PluginTestCase
{
    public function test_bootstrap_sets_reverb_app_credentials_from_env(): void
    {
        putenv('REVERB_APP_ID=moabom-laravel');
        putenv('REVERB_APP_KEY=moabom-laravel-key');
        putenv('REVERB_APP_SECRET=test-secret');

        ReverbCredentialSync::bootstrap();

        $this->assertSame('moabom-laravel-key', config('reverb.apps.apps.0.key'));
        $this->assertSame('test-secret', config('reverb.apps.apps.0.secret'));
        $this->assertSame('127.0.0.1', config('reverb.servers.reverb.host'));
    }

    public function test_merge_env_secret_into_drivers_replaces_empty_db_secret(): void
    {
        putenv('REVERB_APP_SECRET=env-secret');

        $merged = ReverbCredentialSync::mergeEnvSecretIntoDrivers([
            'websocket_app_secret' => '',
        ]);

        $this->assertSame('env-secret', $merged['websocket_app_secret']);
    }
}
