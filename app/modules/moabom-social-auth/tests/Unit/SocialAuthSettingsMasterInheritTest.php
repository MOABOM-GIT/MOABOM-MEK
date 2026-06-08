<?php

namespace Modules\Moabom\Social\Auth\Tests\Unit;

use Modules\Moabom\Social\Auth\Models\SocialAuthSetting;
use Modules\Moabom\Social\Auth\Services\SocialAuthSettingsService;
use Modules\Moabom\Social\Auth\Tests\ModuleTestCase;

require_once dirname(__DIR__).'/ModuleTestCase.php';

class SocialAuthSettingsMasterInheritTest extends ModuleTestCase
{
    public function test_platform_cross_query_uses_prefixed_physical_table_name(): void
    {
        config(['database.connections.mysql.prefix' => 'g7_']);

        $service = app(SocialAuthSettingsService::class);
        $method = new \ReflectionMethod(SocialAuthSettingsService::class, 'physicalSocialAuthSettingsTableName');
        $method->setAccessible(true);

        $this->assertSame('g7_social_auth_settings', $method->invoke($service));
    }

    public function test_get_platform_master_credential_returns_decrypted_values(): void
    {
        SocialAuthSetting::query()->updateOrCreate(
            ['provider' => 'google'],
            [
                'enabled' => true,
                'use_master_defaults' => false,
                'client_id' => 'master-google-client-id',
                'client_secret' => 'master-google-client-secret',
            ]
        );

        $service = app(SocialAuthSettingsService::class);
        $service->clearCache();

        $this->assertSame(
            'master-google-client-id',
            $service->getPlatformMasterCredential('google', 'client_id')
        );
        $this->assertSame(
            'master-google-client-secret',
            $service->getPlatformMasterCredential('google', 'client_secret')
        );
    }
}
