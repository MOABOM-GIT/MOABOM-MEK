<?php

namespace Modules\Moabom\Social\Auth\Tests\Feature;

use Modules\Moabom\Social\Auth\Services\SocialAuthBrokerStateService;
use Modules\Moabom\Social\Auth\Tests\ModuleTestCase;

require_once dirname(__DIR__).'/ModuleTestCase.php';

class SocialAuthBrokerFlowTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        putenv('MOABOM_SOCIAL_AUTH_BROKER_ENABLED=true');
        putenv('MOABOM_SOCIAL_AUTH_BROKER_HOST=auth.mek360.com');
        putenv('MOABOM_SOCIAL_AUTH_BROKER_STATE_SECRET=test-broker-secret');
        putenv('MOABOM_SOCIAL_AUTH_BROKER_STATE_TTL=300');
        $_ENV['MOABOM_SOCIAL_AUTH_BROKER_ENABLED'] = 'true';
        $_ENV['MOABOM_SOCIAL_AUTH_BROKER_HOST'] = 'auth.mek360.com';
        $_ENV['MOABOM_SOCIAL_AUTH_BROKER_STATE_SECRET'] = 'test-broker-secret';
        $_ENV['MOABOM_SOCIAL_AUTH_BROKER_STATE_TTL'] = '300';
    }

    public function test_platform_host_redirect_routes_to_broker(): void
    {
        $this->setProviderEnv('google');

        $response = $this->call(
            'GET',
            '/api/modules/moabom-social-auth/google/redirect?popup=1',
            [],
            [],
            ['HTTP_HOST' => 'mek360.com', 'HTTPS' => 'on'],
        );

        $response->assertRedirect();
        $location = (string) $response->headers->get('Location');
        $this->assertStringStartsWith(
            'https://auth.mek360.com/api/modules/moabom-social-auth/oauth/google/start',
            $location
        );
    }

    public function test_broker_start_rejects_tampered_state(): void
    {
        $this->setProviderEnv('google');

        $service = app(SocialAuthBrokerStateService::class);
        $token = $service->issueTenantState('freshent.mek360.com', 'google', true).'x';

        $response = $this->callBrokerStart('google', $token);

        $response->assertRedirect();
        $location = urldecode((string) $response->headers->get('Location'));
        $this->assertStringContainsString('social_auth_error', $location);
    }

    public function test_broker_start_rejects_provider_mismatch_in_state(): void
    {
        $this->setProviderEnv('google');

        $service = app(SocialAuthBrokerStateService::class);
        $token = $service->issueTenantState('freshent.mek360.com', 'kakao', false);

        $response = $this->callBrokerStart('google', $token);

        $response->assertRedirect();
        $location = urldecode((string) $response->headers->get('Location'));
        $this->assertStringContainsString('social_auth_error', $location);
    }

    public function test_same_provider_user_id_links_to_same_local_user_only(): void
    {
        $this->setProviderEnv('google');

        \Illuminate\Support\Facades\Http::fake([
            'https://oauth2.googleapis.com/token' => \Illuminate\Support\Facades\Http::response([
                'access_token' => 'google-access-token',
                'expires_in' => 3600,
            ]),
            'https://www.googleapis.com/oauth2/v3/userinfo' => \Illuminate\Support\Facades\Http::response([
                'sub' => 'shared-google-subject',
                'email' => 'tenant-a-user@example.com',
                'name' => 'Tenant A User',
            ]),
        ]);

        $state = $this->extractStateFromRedirect(
            $this->get('/api/modules/moabom-social-auth/google/redirect')
                ->assertRedirect()
                ->headers->get('Location')
        );

        $callback = $this->get("/api/modules/moabom-social-auth/google/callback?code=valid-code&state={$state}")
            ->assertRedirect();
        $firstCode = $this->extractSocialAuthCode($callback->headers->get('Location'));

        $firstExchange = $this->postJson('/api/modules/moabom-social-auth/exchange', [
            'code' => $firstCode,
        ])->assertOk()->json('data');

        $state = $this->extractStateFromRedirect(
            $this->get('/api/modules/moabom-social-auth/google/redirect')
                ->assertRedirect()
                ->headers->get('Location')
        );

        $callback = $this->get("/api/modules/moabom-social-auth/google/callback?code=valid-code-2&state={$state}")
            ->assertRedirect();
        $secondCode = $this->extractSocialAuthCode($callback->headers->get('Location'));

        $secondExchange = $this->postJson('/api/modules/moabom-social-auth/exchange', [
            'code' => $secondCode,
        ])->assertOk()->json('data');

        $this->assertSame($firstExchange['user']['uuid'], $secondExchange['user']['uuid']);
        $this->assertSame(1, \Modules\Moabom\Social\Auth\Models\SocialAccount::query()
            ->where('provider', 'google')
            ->where('provider_user_id', 'shared-google-subject')
            ->count());
    }

    private function callBrokerStart(string $provider, string $state): \Illuminate\Testing\TestResponse
    {
        return $this->call(
            'GET',
            "/api/modules/moabom-social-auth/oauth/{$provider}/start?state=".urlencode($state),
            [],
            [],
            ['HTTP_HOST' => 'auth.mek360.com', 'HTTPS' => 'on'],
        );
    }

    private function extractStateFromRedirect(?string $location): string
    {
        parse_str((string) parse_url((string) $location, PHP_URL_QUERY), $query);

        return (string) $query['state'];
    }

    private function extractSocialAuthCode(?string $location): string
    {
        parse_str((string) parse_url((string) $location, PHP_URL_QUERY), $query);

        return (string) $query['social_auth_code'];
    }
}
