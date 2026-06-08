<?php

namespace Modules\Moabom\Social\Auth\Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Modules\Moabom\Social\Auth\Services\SocialAuthSettingsService;
use Modules\Moabom\Social\Auth\Tests\ModuleTestCase;

require_once dirname(__DIR__).'/ModuleTestCase.php';

class SocialAuthFlowTest extends ModuleTestCase
{
    public function test_google_callback_links_existing_user_by_email_and_exchanges_token(): void
    {
        $this->setProviderEnv('google');
        User::query()->where('email', 'social@example.com')->delete();
        $user = User::factory()->create([
            'email' => 'social@example.com',
            'status' => 'active',
        ]);

        Http::fake([
            'https://oauth2.googleapis.com/token' => Http::response([
                'access_token' => 'google-access-token',
                'expires_in' => 3600,
            ]),
            'https://www.googleapis.com/oauth2/v3/userinfo' => Http::response([
                'sub' => 'google-user-1',
                'email' => 'social@example.com',
                'name' => '소셜 사용자',
                'picture' => 'https://example.com/avatar.png',
            ]),
        ]);

        $state = $this->extractStateFromRedirect(
            $this->get('/api/modules/moabom-social-auth/google/redirect')
                ->assertRedirect()
                ->headers->get('Location')
        );

        $callback = $this->get("/api/modules/moabom-social-auth/google/callback?code=valid-code&state={$state}")
            ->assertRedirect();

        $socialAuthCode = $this->extractSocialAuthCode($callback->headers->get('Location'));

        $exchange = $this->postJson('/api/modules/moabom-social-auth/exchange', [
            'code' => $socialAuthCode,
        ])->assertOk()->json('data');

        $this->assertSame('Bearer', $exchange['token_type']);
        $this->assertNotEmpty($exchange['token']);
        $this->assertSame($user->uuid, $exchange['user']['uuid']);
        $this->assertDatabaseHas('social_accounts', [
            'user_id' => $user->id,
            'provider' => 'google',
            'provider_user_id' => 'google-user-1',
            'email' => 'social@example.com',
        ]);
    }

    public function test_kakao_callback_creates_new_user_and_social_account(): void
    {
        $this->setProviderEnv('kakao');

        Http::fake([
            'https://kauth.kakao.com/oauth/token' => Http::response([
                'access_token' => 'kakao-access-token',
                'refresh_token' => 'kakao-refresh-token',
                'expires_in' => 3600,
            ]),
            'https://kapi.kakao.com/v2/user/me' => Http::response([
                'id' => 12345,
                'kakao_account' => [
                    'email' => 'new-social@example.com',
                    'profile' => [
                        'nickname' => '카카오사용자',
                        'profile_image_url' => 'https://example.com/kakao.png',
                    ],
                ],
            ]),
        ]);

        $state = $this->extractStateFromRedirect(
            $this->get('/api/modules/moabom-social-auth/kakao/redirect')
                ->assertRedirect()
                ->headers->get('Location')
        );

        $callback = $this->get("/api/modules/moabom-social-auth/kakao/callback?code=valid-code&state={$state}")
            ->assertRedirect();

        $socialAuthCode = $this->extractSocialAuthCode($callback->headers->get('Location'));

        $exchange = $this->postJson('/api/modules/moabom-social-auth/exchange', [
            'code' => $socialAuthCode,
        ])->assertOk()->json('data');

        $this->assertFalse($exchange['requires_profile_completion']);
        $this->assertNotEmpty($exchange['token']);

        $createdUser = User::where('email', 'new-social@example.com')->first();
        $this->assertNotNull($createdUser);
        $this->assertTrue($createdUser->roles()->where('identifier', 'user')->exists());
        $this->assertDatabaseHas('social_accounts', [
            'user_id' => $createdUser->id,
            'provider' => 'kakao',
            'provider_user_id' => '12345',
            'email' => 'new-social@example.com',
        ]);
    }

    public function test_kakao_callback_creates_user_with_synthetic_email_when_email_is_missing(): void
    {
        $this->setProviderEnv('kakao');

        Http::fake([
            'https://kauth.kakao.com/oauth/token' => Http::response([
                'access_token' => 'kakao-access-token',
                'refresh_token' => 'kakao-refresh-token',
                'expires_in' => 3600,
            ]),
            'https://kapi.kakao.com/v2/user/me' => Http::response([
                'id' => 98765,
                'kakao_account' => [
                    'profile' => [
                        'nickname' => '이메일없는카카오',
                        'profile_image_url' => 'https://example.com/kakao-no-email.png',
                    ],
                ],
            ]),
        ]);

        $state = $this->extractStateFromRedirect(
            $this->get('/api/modules/moabom-social-auth/kakao/redirect')
                ->assertRedirect()
                ->headers->get('Location')
        );

        $callback = $this->get("/api/modules/moabom-social-auth/kakao/callback?code=valid-code&state={$state}")
            ->assertRedirect();

        $socialAuthCode = $this->extractSocialAuthCode($callback->headers->get('Location'));

        $exchange = $this->postJson('/api/modules/moabom-social-auth/exchange', [
            'code' => $socialAuthCode,
        ])->assertOk()->json('data');

        $this->assertFalse($exchange['requires_profile_completion']);
        $this->assertNotEmpty($exchange['token']);

        $createdUser = User::where('nickname', '이메일없는카카오')->first();
        $this->assertNotNull($createdUser);
        $this->assertStringEndsWith('@social-auth.invalid', $createdUser->email);
        $this->assertSame($createdUser->uuid, $exchange['user']['uuid']);
        $this->assertDatabaseHas('social_accounts', [
            'user_id' => $createdUser->id,
            'provider' => 'kakao',
            'provider_user_id' => '98765',
            'email' => null,
        ]);
    }

    public function test_kakao_callback_allows_existing_social_account_without_email(): void
    {
        $this->setProviderEnv('kakao');

        Http::fake([
            'https://kauth.kakao.com/oauth/token' => Http::response([
                'access_token' => 'kakao-access-token',
                'refresh_token' => 'kakao-refresh-token',
                'expires_in' => 3600,
            ]),
            'https://kapi.kakao.com/v2/user/me' => Http::response([
                'id' => 11111,
                'kakao_account' => [
                    'profile' => [
                        'nickname' => '기존카카오',
                    ],
                ],
            ]),
        ]);

        $state = $this->extractStateFromRedirect(
            $this->get('/api/modules/moabom-social-auth/kakao/redirect')
                ->assertRedirect()
                ->headers->get('Location')
        );

        $callback = $this->get("/api/modules/moabom-social-auth/kakao/callback?code=valid-code&state={$state}")
            ->assertRedirect();
        $socialAuthCode = $this->extractSocialAuthCode($callback->headers->get('Location'));
        $firstExchange = $this->postJson('/api/modules/moabom-social-auth/exchange', [
            'code' => $socialAuthCode,
        ])->assertOk()->json('data');

        $state = $this->extractStateFromRedirect(
            $this->get('/api/modules/moabom-social-auth/kakao/redirect')
                ->assertRedirect()
                ->headers->get('Location')
        );

        $callback = $this->get("/api/modules/moabom-social-auth/kakao/callback?code=valid-code-2&state={$state}")
            ->assertRedirect();
        $socialAuthCode = $this->extractSocialAuthCode($callback->headers->get('Location'));
        $secondExchange = $this->postJson('/api/modules/moabom-social-auth/exchange', [
            'code' => $socialAuthCode,
        ])->assertOk()->json('data');

        $this->assertSame($firstExchange['user']['uuid'], $secondExchange['user']['uuid']);
    }

    public function test_naver_token_request_includes_state(): void
    {
        $this->setProviderEnv('naver');

        User::factory()->create([
            'email' => 'naver-social@example.com',
            'status' => 'active',
        ]);

        Http::fake([
            'https://nid.naver.com/oauth2.0/token' => Http::response([
                'access_token' => 'naver-access-token',
                'refresh_token' => 'naver-refresh-token',
                'expires_in' => 3600,
            ]),
            'https://openapi.naver.com/v1/nid/me' => Http::response([
                'response' => [
                    'id' => 'naver-user-1',
                    'email' => 'naver-social@example.com',
                    'name' => '네이버사용자',
                    'nickname' => '네이버',
                    'profile_image' => 'https://example.com/naver.png',
                ],
            ]),
        ]);

        $state = $this->extractStateFromRedirect(
            $this->get('/api/modules/moabom-social-auth/naver/redirect')
                ->assertRedirect()
                ->headers->get('Location')
        );

        $this->get("/api/modules/moabom-social-auth/naver/callback?code=valid-code&state={$state}")
            ->assertRedirect();

        Http::assertSent(function ($request) use ($state) {
            return $request->url() === 'https://nid.naver.com/oauth2.0/token'
                && ($request->data()['state'] ?? null) === $state;
        });
    }

    public function test_callback_redirects_to_login_when_provider_config_is_missing(): void
    {
        putenv('SOCIAL_AUTH_NAVER_CLIENT_ID');
        putenv('SOCIAL_AUTH_NAVER_CLIENT_SECRET');
        unset($_ENV['SOCIAL_AUTH_NAVER_CLIENT_ID'], $_ENV['SOCIAL_AUTH_NAVER_CLIENT_SECRET']);

        app(SocialAuthSettingsService::class)->clearCache();
        app(SocialAuthSettingsService::class)->saveSettings([
            'providers' => [
                'naver_enabled' => false,
                'naver_client_id' => '',
                'naver_client_secret' => '',
                'naver_redirect_uri' => '',
                'kakao_use_client_secret' => true,
            ],
        ]);

        $response = $this->get('/api/modules/moabom-social-auth/naver/redirect')
            ->assertRedirect();

        $this->assertStringContainsString('/login?social_auth_error=', $response->headers->get('Location'));
    }

    public function test_callback_uses_provider_error_description(): void
    {
        $this->setProviderEnv('kakao');

        $state = $this->extractStateFromRedirect(
            $this->get('/api/modules/moabom-social-auth/kakao/redirect')
                ->assertRedirect()
                ->headers->get('Location')
        );

        $response = $this->get("/api/modules/moabom-social-auth/kakao/callback?error=access_denied&error_description=user_cancelled&state={$state}")
            ->assertRedirect();

        $this->assertStringContainsString('social_auth_error=user_cancelled', urldecode($response->headers->get('Location')));
    }

    public function test_exchange_rejects_invalid_code(): void
    {
        $this->postJson('/api/modules/moabom-social-auth/exchange', [
            'code' => str_repeat('x', 64),
        ])->assertStatus(422);
    }

    public function test_popup_complete_renders_post_message_without_session(): void
    {
        $response = $this->get('/api/modules/moabom-social-auth/google/popup-complete?status=success&code=abc123&provider=google');

        $response->assertOk();
        $response->assertSee('postMessage', false);
        $response->assertSee('moabom-social-auth', false);
        $response->assertSee('abc123', false);
        $response->assertDontSee('invalid_popup_session', false);
    }

    public function test_popup_redirect_includes_popup_query(): void
    {
        $this->setProviderEnv('google');

        $response = $this->get('/api/modules/moabom-social-auth/google/redirect?popup=1')
            ->assertRedirect();

        $this->assertStringContainsString('state=', $response->headers->get('Location'));
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
