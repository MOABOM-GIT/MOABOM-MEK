<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Modules\Moabom\Apps\Services\WebsiteLinkIconStorageService;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

class GeneratedAppWebsiteIconControllerTest extends ModuleTestCase
{
    public function test_store_website_link_serves_persisted_icon(): void
    {
        Http::fake([
            'https://example.com' => Http::response(<<<'HTML'
<!DOCTYPE html><html><head>
<link rel="icon" href="https://example.com/favicon.png"/>
</head><body></body></html>
HTML, 200),
            'https://example.com/favicon.png' => Http::response(
                "\x89PNG\r\n\x1a\n",
                200,
                ['Content-Type' => 'image/png'],
            ),
        ]);

        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/modules/moabom-apps/apps/generated', [
            'title' => 'Example',
            'app_type' => 'website_link',
            'html' => '<!DOCTYPE html><html><head></head><body data-moabom-website-link="1"></body></html>',
            'metadata' => [
                'website_url' => 'https://example.com',
                'icon_source_url' => 'https://example.com/favicon.png',
                'icon_from_title' => false,
            ],
        ]);

        $response->assertCreated();
        $appId = (int) $response->json('data.id');
        $iconUrl = (string) $response->json('data.metadata.icon_url');
        $this->assertStringContainsString(
            '/apps/generated/'.$appId.'/website-icon',
            $iconUrl,
        );
        $this->assertStringContainsString('icon_token=', $iconUrl);
        $this->assertFalse($response->json('data.metadata.icon_from_title'));

        $iconStorage = $this->app->make(WebsiteLinkIconStorageService::class);
        $this->assertNotNull($iconStorage->storedIconPath($appId));

        $this->get($iconUrl)->assertOk();
    }

    public function test_private_website_icon_requires_icon_token_for_guest(): void
    {
        Http::fake([
            'https://example.com' => Http::response(<<<'HTML'
<!DOCTYPE html><html><head>
<link rel="icon" href="https://example.com/favicon.png"/>
</head><body></body></html>
HTML, 200),
            'https://example.com/favicon.png' => Http::response(
                "\x89PNG\r\n\x1a\n",
                200,
                ['Content-Type' => 'image/png'],
            ),
        ]);

        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/modules/moabom-apps/apps/generated', [
            'title' => 'Private site',
            'app_type' => 'website_link',
            'html' => '<!DOCTYPE html><html><head></head><body data-moabom-website-link="1"></body></html>',
            'metadata' => [
                'website_url' => 'https://example.com',
                'icon_source_url' => 'https://example.com/favicon.png',
                'icon_from_title' => false,
            ],
        ]);

        $response->assertCreated();
        $appId = (int) $response->json('data.id');

        $this->get('/api/modules/moabom-apps/apps/generated/'.$appId.'/website-icon')
            ->assertNotFound();
    }

    public function test_website_icon_endpoint_returns_not_found_when_icon_file_is_missing(): void
    {
        $user = User::factory()->create();
        $app = GeneratedAppsConnection::apps()->create([
            'tenant_slug' => 'default',
            'user_id' => $user->id,
            'title' => 'Broken icon',
            'app_type' => 'website_link',
            'tier' => 'standard',
            'html' => '<!DOCTYPE html><html><body data-moabom-website-link="1"></body></html>',
            'metadata' => [
                'website_url' => 'https://example.com',
                'icon_url' => '/api/modules/moabom-apps/apps/generated/99/website-icon',
                'stored_icon_path' => '99/website-icon.png',
            ],
        ]);

        Http::fake([
            'https://example.com' => Http::response('', 500),
            'https://example.com/favicon.ico' => Http::response('', 500),
            'https://example.com/favicon.png' => Http::response('', 500),
            'https://example.com/apple-touch-icon.png' => Http::response('', 500),
            'https://example.com/apple-touch-icon-precomposed.png' => Http::response('', 500),
        ]);

        $this->get('/api/modules/moabom-apps/apps/generated/'.$app->id.'/website-icon')
            ->assertNotFound();
    }

    public function test_detail_response_keeps_icon_url_when_stored_path_present_without_gcs_probe(): void
    {
        $user = User::factory()->create();
        $app = GeneratedAppsConnection::apps()->create([
            'tenant_slug' => 'default',
            'user_id' => $user->id,
            'title' => 'Stored path present',
            'app_type' => 'website_link',
            'tier' => 'standard',
            'html' => '<!DOCTYPE html><html><body data-moabom-website-link="1"></body></html>',
            'metadata' => [
                'website_url' => 'https://example.com',
                'icon_url' => '/api/modules/moabom-apps/apps/generated/99/website-icon',
                'stored_icon_path' => '99/website-icon.png',
            ],
        ]);

        $response = $this->actingAs($user)
            ->getJson('/api/modules/moabom-apps/apps/generated/'.$app->id)
            ->assertOk()
            ->assertJsonPath('data.metadata.icon_from_title', false)
            ->assertJsonPath('data.metadata.stored_icon_path', '99/website-icon.png');

        $iconUrl = (string) $response->json('data.metadata.icon_url');
        $this->assertStringContainsString('/apps/generated/'.$app->id.'/website-icon', $iconUrl);
        $this->assertStringContainsString('icon_token=', $iconUrl);
    }
}
