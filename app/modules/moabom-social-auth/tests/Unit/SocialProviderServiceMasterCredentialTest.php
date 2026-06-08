<?php

declare(strict_types=1);

namespace Modules\Moabom\Social\Auth\Tests\Unit;

use Illuminate\Support\Facades\Http;
use Modules\Moabom\Social\Auth\Models\SocialAuthSetting;
use Modules\Moabom\Social\Auth\Services\SocialProviderService;
use Modules\Moabom\Social\Auth\Tests\ModuleTestCase;

require_once dirname(__DIR__).'/ModuleTestCase.php';

class SocialProviderServiceMasterCredentialTest extends ModuleTestCase
{
    public function test_fetch_user_resolves_master_credentials_when_use_master_defaults_is_true(): void
    {
        SocialAuthSetting::query()->updateOrCreate(
            ['provider' => 'google'],
            [
                'enabled' => true,
                'use_master_defaults' => true,
                'client_id' => null,
                'client_secret' => null,
            ]
        );

        SocialAuthSetting::query()->updateOrCreate(
            ['provider' => '__broker'],
            [
                'enabled' => false,
                'use_master_defaults' => true,
                'extra_json' => [
                    'broker_enabled' => true,
                    'broker_host' => 'auth.mek360.com',
                    'broker_scheme' => 'https',
                    'broker_state_ttl_seconds' => 300,
                ],
            ]
        );

        putenv('SOCIAL_AUTH_MASTER_GOOGLE_CLIENT_ID=master-google-id');
        putenv('SOCIAL_AUTH_MASTER_GOOGLE_CLIENT_SECRET=master-google-secret');
        $_ENV['SOCIAL_AUTH_MASTER_GOOGLE_CLIENT_ID'] = 'master-google-id';
        $_ENV['SOCIAL_AUTH_MASTER_GOOGLE_CLIENT_SECRET'] = 'master-google-secret';

        Http::fake([
            'https://oauth2.googleapis.com/token' => Http::response([
                'access_token' => 'google-access-token',
                'expires_in' => 3600,
            ]),
            'https://www.googleapis.com/oauth2/v3/userinfo' => Http::response([
                'sub' => 'google-subject-1',
                'email' => 'master-default-user@example.com',
                'name' => 'Master Default User',
            ]),
        ]);

        $user = app(SocialProviderService::class)->fetchUser('google', 'valid-code', 'state-token');

        $this->assertSame('google', $user->provider);
        $this->assertSame('google-subject-1', $user->providerUserId);
    }
}
