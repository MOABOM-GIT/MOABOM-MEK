<?php

namespace Modules\Moabom\Apps\Tests\Unit;

use App\Models\User;
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

    public function test_published_app_preview_url_includes_token_when_viewer_is_logged_in(): void
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

        $this->assertStringContainsString('preview_token=', $url);
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

        $preview = $this->app->make(GeneratedAppPreviewService::class);
        $headers = $preview->previewResponseHeaders();

        $this->assertStringContainsString('https://*.mek360.com', $headers['Content-Security-Policy']);
        $this->assertStringContainsString('frame-ancestors', $headers['Content-Security-Policy']);
    }
}
