<?php

declare(strict_types=1);

namespace Modules\Moabom\Social\Auth\Tests\Unit;

use Modules\Moabom\Social\Auth\Models\SocialAuthSetting;
use Modules\Moabom\Social\Auth\Services\TenantSocialAuthDatabaseSeeder;
use Modules\Moabom\Social\Auth\Tests\ModuleTestCase;

require_once dirname(__DIR__).'/ModuleTestCase.php';

class TenantSocialAuthDatabaseSeederTest extends ModuleTestCase
{
    public function test_seed_defaults_creates_three_provider_rows(): void
    {
        SocialAuthSetting::query()->delete();

        $result = app(TenantSocialAuthDatabaseSeeder::class)->seedDefaults();

        $this->assertTrue($result['seeded']);
        $this->assertSame(['google', 'kakao', 'naver'], $result['created']);

        foreach (['google', 'kakao', 'naver'] as $provider) {
            $this->assertDatabaseHas('social_auth_settings', [
                'provider' => $provider,
                'enabled' => true,
                'use_master_defaults' => true,
            ]);

            $row = SocialAuthSetting::query()->where('provider', $provider)->firstOrFail();
            $this->assertNull($row->client_id);
            $this->assertNull($row->client_secret);
        }
    }

    public function test_seed_defaults_enables_existing_disabled_rows(): void
    {
        SocialAuthSetting::query()->updateOrCreate(
            ['provider' => 'naver'],
            [
                'enabled' => false,
                'use_master_defaults' => true,
                'client_id' => null,
                'client_secret' => null,
            ]
        );

        app(TenantSocialAuthDatabaseSeeder::class)->seedDefaults();

        $row = SocialAuthSetting::query()->where('provider', 'naver')->firstOrFail();
        $this->assertTrue($row->enabled);
    }

    public function test_seed_defaults_normalizes_existing_tenant_credentials(): void
    {
        SocialAuthSetting::query()->updateOrCreate(
            ['provider' => 'google'],
            [
                'enabled' => true,
                'use_master_defaults' => false,
                'client_id' => 'stale-tenant-id',
                'client_secret' => 'stale-tenant-secret',
            ]
        );

        $result = app(TenantSocialAuthDatabaseSeeder::class)->seedDefaults();

        $this->assertTrue($result['seeded']);
        $this->assertSame([], $result['created']);

        $row = SocialAuthSetting::query()->where('provider', 'google')->firstOrFail();
        $this->assertTrue($row->enabled);
        $this->assertTrue($row->use_master_defaults);
        $this->assertNull($row->client_id);
        $this->assertNull($row->client_secret);
    }
}
