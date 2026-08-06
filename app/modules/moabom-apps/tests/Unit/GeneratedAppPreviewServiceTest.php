<?php

namespace Modules\Moabom\Apps\Tests\Unit;

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Modules\Moabom\Apps\Enums\AppTier;
use Modules\Moabom\Apps\Services\AiAppService;
use Modules\Moabom\Apps\Services\GeneratedAppPreviewService;
use Modules\Moabom\Apps\Support\GeneratedAppPreviewRouting;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

class GeneratedAppPreviewServiceTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'moabom-apps.preview.routing' => GeneratedAppPreviewRouting::MODE_DEDICATED_HOST,
            'moabom-apps.preview.scheme' => 'https',
            'moabom-apps.preview.standard_host' => 'apps.mek360.com',
            'moabom-apps.preview.hosted_apps_domain' => 'apps.mek360.com',
            'moabom-system.saas.enabled' => false,
            'app.url' => 'https://smoke.mek360.com',
        ]);
    }

    public function test_build_preview_url_uses_apps_host_for_standard(): void
    {
        $owner = User::factory()->create();
        $ai = $this->app->make(AiAppService::class);
        $preview = $this->app->make(GeneratedAppPreviewService::class);

        $app = $ai->store($owner->id, [
            'title' => 'Standard',
            'app_type' => 'general',
            'html' => '<!DOCTYPE html><html><head></head><body>ok</body></html>',
        ]);

        $url = $preview->buildPreviewUrl($app, $owner->id);

        $this->assertStringStartsWith('https://apps.mek360.com/g/'.$app->id, $url);
        $this->assertStringContainsString('preview_token=', $url);
    }

    public function test_published_app_preview_url_omits_token_when_viewer_is_logged_in(): void
    {
        $owner = User::factory()->create();
        $ai = $this->app->make(AiAppService::class);
        $preview = $this->app->make(GeneratedAppPreviewService::class);

        $app = $ai->store($owner->id, [
            'title' => '등록 앱',
            'app_type' => 'general',
            'html' => '<!DOCTYPE html><html><head></head><body>ok</body></html>',
            'visibility' => 'tenant',
        ]);

        $url = $preview->buildPreviewUrl($app, $owner->id);

        $this->assertStringStartsWith('https://apps.mek360.com/g/'.$app->id, $url);
        $this->assertStringNotContainsString('preview_token=', $url);
    }

    public function test_published_app_preview_url_has_no_token_for_guest_viewer(): void
    {
        $owner = User::factory()->create();
        $ai = $this->app->make(AiAppService::class);
        $preview = $this->app->make(GeneratedAppPreviewService::class);

        $app = $ai->store($owner->id, [
            'title' => '등록 앱',
            'app_type' => 'general',
            'html' => '<!DOCTYPE html><html><head></head><body>ok</body></html>',
            'visibility' => 'tenant',
        ]);

        $url = $preview->buildPreviewUrl($app, null);

        $this->assertStringNotContainsString('preview_token=', $url);
    }

    public function test_hosted_published_preview_url_still_includes_token_for_data_scope(): void
    {
        $owner = User::factory()->create();
        $ai = $this->app->make(AiAppService::class);
        $preview = $this->app->make(GeneratedAppPreviewService::class);

        $app = $ai->store($owner->id, [
            'title' => 'Hosted 공개',
            'app_type' => 'general',
            'tier' => AppTier::Hosted->value,
            'html' => '<!DOCTYPE html><html><head></head><body>ok</body></html>',
            'visibility' => 'tenant',
        ]);

        $url = $preview->buildPreviewUrl($app, $owner->id);

        $this->assertStringContainsString('preview_token=', $url);
    }

    public function test_hosted_store_uses_apps_subdomain_origin(): void
    {
        $owner = User::factory()->create();
        $ai = $this->app->make(AiAppService::class);
        $preview = $this->app->make(GeneratedAppPreviewService::class);

        $app = $ai->store($owner->id, [
            'title' => 'Hosted',
            'app_type' => 'general',
            'tier' => AppTier::Hosted->value,
            'html' => '<!DOCTYPE html><html><head></head><body>ok</body></html>',
        ]);

        $this->assertSame((string) $app->id, $app->hosted_subdomain);
        $this->assertStringStartsWith(
            'https://'.$app->id.'.apps.mek360.com/',
            $preview->buildPreviewUrl($app, $owner->id),
        );
    }

    public function test_hosted_personal_data_requires_token_for_read_and_write(): void
    {
        $owner = User::factory()->create();
        $ai = $this->app->make(AiAppService::class);
        $preview = $this->app->make(GeneratedAppPreviewService::class);

        $app = $ai->store($owner->id, [
            'title' => 'Hosted',
            'app_type' => 'general',
            'tier' => AppTier::Hosted->value,
            'html' => '<!DOCTYPE html><html><head></head><body>ok</body></html>',
            'visibility' => 'tenant',
        ]);

        $this->assertFalse($preview->canAccessHostedDataRead($app, null));
        $this->assertFalse($preview->canAccessHostedDataWrite($app, null));

        $token = $preview->issueAccessToken($app, $owner->id);
        $this->assertTrue($preview->canAccessHostedDataRead($app, $token));
        $this->assertTrue($preview->canAccessHostedDataWrite($app, $token));
    }

    public function test_guest_can_access_tenant_published_html_on_dedicated_preview_host(): void
    {
        $owner = User::factory()->create();
        $ai = $this->app->make(AiAppService::class);
        $preview = $this->app->make(GeneratedAppPreviewService::class);

        $app = $ai->store($owner->id, [
            'title' => '등록 앱',
            'app_type' => 'general',
            'html' => '<!DOCTYPE html><html><head></head><body>ok</body></html>',
            'visibility' => 'tenant',
        ]);

        $this->withServerVariables(['HTTP_HOST' => 'apps.mek360.com']);

        $this->assertTrue($preview->canAccessPreviewHtml($app, null));
    }

    public function test_guest_cannot_access_private_html_on_dedicated_preview_host(): void
    {
        $owner = User::factory()->create();
        $ai = $this->app->make(AiAppService::class);
        $preview = $this->app->make(GeneratedAppPreviewService::class);

        $app = $ai->store($owner->id, [
            'title' => '비공개',
            'app_type' => 'general',
            'html' => '<!DOCTYPE html><html><head></head><body>ok</body></html>',
            'visibility' => 'private',
        ]);

        $this->withServerVariables(['HTTP_HOST' => 'apps.mek360.com']);

        $this->assertFalse($preview->canAccessPreviewHtml($app, null));
    }

    public function test_private_html_paste_preview_url_includes_token_for_viewer(): void
    {
        $owner = User::factory()->create();
        $ai = $this->app->make(AiAppService::class);
        $preview = $this->app->make(GeneratedAppPreviewService::class);

        $app = $ai->store($owner->id, [
            'title' => '직접입력',
            'app_type' => 'html_paste',
            'html' => '<!DOCTYPE html><html><head></head><body><h1>paste</h1></body></html>',
            'visibility' => 'private',
        ]);

        $url = $preview->buildPreviewUrl($app, $owner->id);

        $this->assertStringStartsWith('https://apps.mek360.com/g/'.$app->id, $url);
        $this->assertStringContainsString('preview_token=', $url);

        $queryString = (string) parse_url($url, PHP_URL_QUERY);
        parse_str($queryString, $query);
        $this->withServerVariables(['HTTP_HOST' => 'apps.mek360.com']);
        $this->assertTrue($preview->canAccessPreviewHtml($app, (string) ($query['preview_token'] ?? '')));
    }

    public function test_website_link_preview_url_uses_metadata_external_url(): void
    {
        Http::fake();

        $owner = User::factory()->create();
        $ai = $this->app->make(AiAppService::class);
        $preview = $this->app->make(GeneratedAppPreviewService::class);

        $app = $ai->store($owner->id, [
            'title' => '네이버',
            'app_type' => 'website_link',
            'prompt' => '포털',
            'html' => '<!DOCTYPE html><html><head></head><body data-moabom-website-link="1"></body></html>',
            'metadata' => [
                'website_url' => 'https://www.naver.com',
            ],
            'visibility' => 'private',
        ]);

        $url = $preview->buildPreviewUrl($app, $owner->id);

        $this->assertSame('https://www.naver.com', $url);
        $this->assertStringNotContainsString('preview_token=', $url);
        $this->assertStringNotContainsString('/g/', $url);
    }

    public function test_build_preview_url_if_token_free_returns_url_for_published_standard(): void
    {
        $owner = User::factory()->create();
        $ai = $this->app->make(AiAppService::class);
        $preview = $this->app->make(GeneratedAppPreviewService::class);

        $app = $ai->store($owner->id, [
            'title' => '공개 standard',
            'app_type' => 'general',
            'html' => '<!DOCTYPE html><html><head></head><body>ok</body></html>',
            'visibility' => 'tenant',
        ]);

        $url = $preview->buildPreviewUrlIfTokenFree($app);

        $this->assertNotNull($url);
        $this->assertStringStartsWith('https://apps.mek360.com/g/'.$app->id, (string) $url);
        $this->assertStringNotContainsString('preview_token=', (string) $url);
    }

    public function test_build_preview_url_if_token_free_is_null_for_private_and_hosted_and_website(): void
    {
        Http::fake();

        $owner = User::factory()->create();
        $ai = $this->app->make(AiAppService::class);
        $preview = $this->app->make(GeneratedAppPreviewService::class);

        $private = $ai->store($owner->id, [
            'title' => '비공개',
            'app_type' => 'general',
            'html' => '<!DOCTYPE html><html><head></head><body>ok</body></html>',
            'visibility' => 'private',
        ]);
        $hosted = $ai->store($owner->id, [
            'title' => 'Hosted',
            'app_type' => 'general',
            'tier' => AppTier::Hosted->value,
            'html' => '<!DOCTYPE html><html><head></head><body>ok</body></html>',
            'visibility' => 'tenant',
        ]);
        $website = $ai->store($owner->id, [
            'title' => '네이버',
            'app_type' => 'website_link',
            'html' => '<!DOCTYPE html><html><head></head><body data-moabom-website-link="1"></body></html>',
            'metadata' => ['website_url' => 'https://www.naver.com'],
            'visibility' => 'tenant',
        ]);

        $this->assertNull($preview->buildPreviewUrlIfTokenFree($private));
        $this->assertNull($preview->buildPreviewUrlIfTokenFree($hosted));
        $this->assertNull($preview->buildPreviewUrlIfTokenFree($website));
    }

    public function test_library_list_serialization_includes_token_free_preview_url_for_published_only(): void
    {
        $owner = User::factory()->create();
        $ai = $this->app->make(AiAppService::class);

        $published = $ai->store($owner->id, [
            'title' => '공개',
            'app_type' => 'general',
            'html' => '<!DOCTYPE html><html><head></head><body>ok</body></html>',
            'visibility' => 'tenant',
        ]);
        $private = $ai->store($owner->id, [
            'title' => '비공개',
            'app_type' => 'general',
            'html' => '<!DOCTYPE html><html><head></head><body>ok</body></html>',
            'visibility' => 'private',
        ]);

        $publishedPayload = $ai->serializeForLibraryList($published, $owner->id);
        $privatePayload = $ai->serializeForLibraryList($private, $owner->id);

        $this->assertArrayHasKey('preview_url', $publishedPayload);
        $this->assertStringNotContainsString('preview_token=', (string) $publishedPayload['preview_url']);
        $this->assertArrayNotHasKey('preview_url', $privatePayload);
    }

    public function test_preview_html_is_stable_across_calls_for_published_standard(): void
    {
        $owner = User::factory()->create();
        $ai = $this->app->make(AiAppService::class);
        $preview = $this->app->make(GeneratedAppPreviewService::class);

        $app = $ai->store($owner->id, [
            'title' => '공개',
            'app_type' => 'general',
            'html' => '<!DOCTYPE html><html><head></head><body>hello cached</body></html>',
            'visibility' => 'tenant',
        ]);

        $first = $preview->previewHtml($app, null);
        $second = $preview->previewHtml($app, null);

        $this->assertSame($first, $second);
        $this->assertStringContainsString('hello cached', $first);
    }

    public function test_preview_response_headers_allow_tenant_shell_subdomains(): void
    {
        config([
            'moabom-apps.preview.scheme' => 'https',
            'moabom-apps.preview.hosted_base_domain' => 'mek360.com',
            'moabom-apps.preview.shell_frame_ancestors' => [
                'https://mek360.com',
                'https://www.mek360.com',
            ],
        ]);

        $owner = User::factory()->create();
        $ai = $this->app->make(AiAppService::class);
        $preview = $this->app->make(GeneratedAppPreviewService::class);
        $privateApp = $ai->store($owner->id, [
            'title' => '비공개',
            'app_type' => 'general',
            'html' => '<!DOCTYPE html><html><head></head><body>ok</body></html>',
            'visibility' => 'private',
        ]);
        $publishedApp = $ai->store($owner->id, [
            'title' => '공개',
            'app_type' => 'general',
            'html' => '<!DOCTYPE html><html><head></head><body>ok</body></html>',
            'visibility' => 'tenant',
        ]);

        $privateHeaders = $preview->previewResponseHeaders($privateApp, 'tok');
        $this->assertStringContainsString('https://*.mek360.com', $privateHeaders['Content-Security-Policy']);
        $this->assertStringContainsString('frame-ancestors', $privateHeaders['Content-Security-Policy']);
        $this->assertSame('?1', $privateHeaders['Origin-Agent-Cluster'] ?? null);
        $this->assertSame('private, max-age=60', $privateHeaders['Cache-Control'] ?? null);

        $publicHeaders = $preview->previewResponseHeaders($publishedApp, null);
        $this->assertSame('public, max-age=300', $publicHeaders['Cache-Control'] ?? null);
    }
}
