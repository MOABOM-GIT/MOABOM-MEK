<?php

namespace Modules\Moabom\Apps\Tests\Unit;

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Modules\Moabom\Apps\Services\AiAppService;
use Modules\Moabom\Apps\Services\WebsiteLinkIconStorageService;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

class AiAppServiceTest extends ModuleTestCase
{
    public function test_ai_app_service_stores_generated_app(): void
    {
        $user = User::factory()->create();
        $service = $this->app->make(AiAppService::class);

        $app = $service->store($user->id, [
            'title' => '테스트 앱',
            'app_type' => 'general',
            'model_id' => 'claude-sonnet',
            'prompt' => '테스트 프롬프트',
            'html' => '<!DOCTYPE html><html><head></head><body>테스트</body></html>',
            'metadata' => ['source' => 'test'],
        ]);

        $this->assertSame($user->id, $app->user_id);
        $this->assertSame('테스트 앱', $app->title);
        $this->assertFalse($app->is_shared);
        $this->assertDatabaseHas('moabom_system_generated_apps', [
            'id' => $app->id,
            'user_id' => $user->id,
            'app_type' => 'general',
            'is_shared' => false,
        ]);
    }

    public function test_openai_payload_omits_temperature_for_gpt_5_models(): void
    {
        config(['moabom-apps.ai.max_output_tokens' => 12000]);

        $service = $this->app->make(AiAppService::class);
        $payload = $service->buildOpenAiChatPayload('gpt-5.1-chat-latest', [
            ['role' => 'user', 'content' => '테스트'],
        ], stream: true);

        $this->assertArrayNotHasKey('temperature', $payload);
        $this->assertTrue($payload['stream']);
        $this->assertSame(12000, $payload['max_completion_tokens']);
    }

    public function test_openai_payload_keeps_temperature_for_legacy_models(): void
    {
        $service = $this->app->make(AiAppService::class);
        $payload = $service->buildOpenAiChatPayload('gpt-4o', [
            ['role' => 'user', 'content' => '테스트'],
        ]);

        $this->assertSame(0.7, $payload['temperature']);
    }

    public function test_patch_generation_keeps_current_html_when_provider_is_disabled(): void
    {
        config(['moabom-apps.ai.provider' => 'disabled']);

        $service = $this->app->make(AiAppService::class);
        $currentHtml = '<!DOCTYPE html><html><head><title>x</title></head><body>old</body></html>';
        $result = $service->generate([
            'prompt' => '버튼 색상을 바꿔줘',
            'app_type' => 'general',
            'model_id' => 'claude-sonnet',
            'current_html' => $currentHtml,
            'generation_mode' => 'patch',
        ]);

        $this->assertTrue($result['fallback']);
        $this->assertSame($currentHtml, $result['html']);
        $this->assertSame($currentHtml, $result['raw']);
    }

    public function test_patch_stream_result_keeps_current_html_when_provider_fails(): void
    {
        $service = $this->app->make(AiAppService::class);
        $currentHtml = '<!DOCTYPE html><html><head><title>x</title></head><body>old</body></html>';
        $result = $service->buildStreamResult(
            [
                'prompt' => '버튼 색상을 바꿔줘',
                'app_type' => 'general',
                'model_id' => 'claude-sonnet',
                'current_html' => $currentHtml,
                'generation_mode' => 'patch',
            ],
            '',
            'anthropic',
            'claude-sonnet-4-6',
            false,
            'error',
        );

        $this->assertTrue($result['fallback']);
        $this->assertSame($currentHtml, $result['html']);
        $this->assertSame($currentHtml, $result['raw']);
    }

    public function test_patch_stream_result_applies_multiple_search_replace_pairs(): void
    {
        $service = $this->app->make(AiAppService::class);
        $currentHtml = '<!DOCTYPE html><html><head><title>old</title></head><body><main><h1>old</h1><p>old body</p></main></body></html>';
        $patch = <<<'PATCH'
<<<MOABOM_PATCH>>>
---SEARCH---
<title>old</title>
---REPLACE---
<title>new</title>
---SEARCH---
<h1>old</h1><p>old body</p>
---REPLACE---
<h1>new</h1><p>new body</p>
<<<END_PATCH>>>
PATCH;

        $result = $service->buildStreamResult(
            [
                'prompt' => '제목과 본문을 바꿔줘',
                'app_type' => 'general',
                'model_id' => 'claude-sonnet',
                'current_html' => $currentHtml,
                'generation_mode' => 'patch',
            ],
            $patch,
            'anthropic',
            'claude-sonnet-4-6',
            false,
            'stop',
        );

        $this->assertStringContainsString('<title>new</title>', $result['html']);
        $this->assertStringContainsString('<h1>new</h1><p>new body</p>', $result['html']);
        $this->assertStringNotContainsString('<<<MOABOM_PATCH>>>', $result['html']);
        $this->assertSame($patch, $result['raw']);
    }

    public function test_patch_stream_result_keeps_current_html_when_no_patch_matches(): void
    {
        $service = $this->app->make(AiAppService::class);
        $currentHtml = '<!DOCTYPE html><html><head><title>x</title></head><body><main>old</main></body></html>';
        $patch = <<<'PATCH'
<<<MOABOM_PATCH>>>
---SEARCH---
<main>missing</main>
---REPLACE---
<main>new</main>
<<<END_PATCH>>>
PATCH;

        $result = $service->buildStreamResult(
            [
                'prompt' => '본문을 바꿔줘',
                'app_type' => 'general',
                'model_id' => 'claude-sonnet',
                'current_html' => $currentHtml,
                'generation_mode' => 'patch',
            ],
            $patch,
            'anthropic',
            'claude-sonnet-4-6',
            false,
            'stop',
        );

        $this->assertSame($currentHtml, $result['html']);
        $this->assertStringNotContainsString('<<<MOABOM_PATCH>>>', $result['html']);
    }

    public function test_store_injects_csp_meta_into_generated_html(): void
    {
        $user = User::factory()->create();
        $service = $this->app->make(AiAppService::class);

        $app = $service->store($user->id, [
            'title' => 'CSP 주입',
            'app_type' => 'general',
            'html' => '<!DOCTYPE html><html><head><title>x</title></head><body>ok</body></html>',
        ]);

        $this->assertStringContainsString('http-equiv="Content-Security-Policy"', (string) $app->html);
        // frame-ancestors 는 <meta> 에서 무시되어 콘솔 경고를 유발하므로 제외 (sandbox iframe 격리로 대체).
        $this->assertStringNotContainsString('frame-ancestors', (string) $app->html);
        $this->assertStringContainsString("base-uri 'none'", (string) $app->html);
    }

    public function test_store_strips_base_tag_from_generated_html(): void
    {
        $user = User::factory()->create();
        $service = $this->app->make(AiAppService::class);

        $app = $service->store($user->id, [
            'title' => 'base 제거',
            'app_type' => 'general',
            'html' => '<!DOCTYPE html><html><head><base href="https://mek360.com/app/generated-app-8"><title>x</title></head><body>ok</body></html>',
        ]);

        $this->assertStringNotContainsString('<base', (string) $app->html);
    }

    public function test_store_is_idempotent_when_csp_already_present(): void
    {
        $user = User::factory()->create();
        $service = $this->app->make(AiAppService::class);

        $already = '<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src https:;"><title>x</title></head><body>ok</body></html>';

        $app = $service->store($user->id, [
            'title' => '멱등',
            'app_type' => 'general',
            'html' => $already,
        ]);

        $this->assertSame($already, (string) $app->html);
        $this->assertSame(1, substr_count((string) $app->html, 'http-equiv="Content-Security-Policy"'));
    }

    public function test_update_injects_csp_meta(): void
    {
        $user = User::factory()->create();
        $service = $this->app->make(AiAppService::class);

        $app = $service->store($user->id, [
            'title' => '원본',
            'app_type' => 'general',
            'html' => '<!DOCTYPE html><html><head></head><body>old</body></html>',
        ]);

        $updated = $service->updateForUser($user->id, $app->id, [
            'title' => '수정',
            'app_type' => 'general',
            'html' => '<!DOCTYPE html><html><head><title>new</title></head><body>new</body></html>',
        ]);

        $this->assertNotNull($updated);
        $this->assertStringContainsString('http-equiv="Content-Security-Policy"', (string) $updated->html);
    }

    public function test_ai_app_service_find_for_user_returns_only_owned_app(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $service = $this->app->make(AiAppService::class);

        $app = $service->store($owner->id, [
            'title' => '소유 앱',
            'app_type' => 'general',
            'html' => '<!DOCTYPE html><html><head></head><body>ok</body></html>',
        ]);

        $this->assertNotNull($service->findForUser($owner->id, $app->id));
        $this->assertNull($service->findForUser($other->id, $app->id));
        $this->assertNull($service->findForUser($owner->id, 999999));
    }

    public function test_shared_generated_apps_are_visible_but_not_manageable_by_other_users(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $service = $this->app->make(AiAppService::class);

        $app = $service->store($owner->id, [
            'title' => '공유 앱',
            'app_type' => 'general',
            'html' => '<!DOCTYPE html><html><head></head><body>shared</body></html>',
            'is_shared' => true,
        ]);

        $this->assertNotNull($service->findVisibleForUser($other->id, $app->id));
        $this->assertNull($service->findForUser($other->id, $app->id));
        $this->assertNull($service->setSharedForUser($other->id, $app->id, false));
    }

    public function test_shared_list_contains_only_shared_generated_apps(): void
    {
        $user = User::factory()->create();
        $service = $this->app->make(AiAppService::class);

        $private = $service->store($user->id, [
            'title' => '비공개',
            'app_type' => 'general',
            'html' => '<!DOCTYPE html><html><head></head><body>private</body></html>',
        ]);
        $shared = $service->store($user->id, [
            'title' => '공유',
            'app_type' => 'general',
            'html' => '<!DOCTYPE html><html><head></head><body>shared</body></html>',
            'is_shared' => true,
        ]);

        $ids = array_column($service->listShared(), 'id');

        $this->assertNotContains($private->id, $ids);
        $this->assertContains($shared->id, $ids);
    }

    public function test_serialize_includes_owner_and_viewer_permissions(): void
    {
        $owner = User::factory()->create([
            'nickname' => 'A',
        ]);
        $viewer = User::factory()->create();
        $service = $this->app->make(AiAppService::class);

        $app = $service->store($owner->id, [
            'title' => '공유',
            'app_type' => 'general',
            'html' => '<!DOCTYPE html><html><head></head><body>shared</body></html>',
            'is_shared' => true,
        ]);

        $ownerPayload = $service->serialize($app->fresh(['user']), includeHtml: false, viewerUserId: $owner->id);
        $viewerPayload = $service->serialize($app->fresh(['user']), includeHtml: false, viewerUserId: $viewer->id);
        $guestPayload = $service->serialize($app->fresh(['user']), includeHtml: false);
        $ownerWithHtml = $service->serialize($app->fresh(['user']), includeHtml: true, viewerUserId: $owner->id);

        $this->assertArrayNotHasKey('html', $ownerPayload);
        $this->assertArrayHasKey('html', $ownerWithHtml);
        $this->assertSame('standard', $ownerPayload['tier']);
        $this->assertStringContainsString('/g/'.$app->id, (string) $ownerPayload['preview_url']);
        $this->assertSame('A', $ownerPayload['owner']['nickname']);
        $this->assertTrue($ownerPayload['permissions']['is_owner']);
        $this->assertTrue($ownerPayload['permissions']['can_share']);
        $this->assertSame('owner', $ownerPayload['permissions']['edit_mode']);
        $this->assertFalse($viewerPayload['permissions']['is_owner']);
        $this->assertTrue($viewerPayload['permissions']['can_edit']);
        $this->assertFalse($viewerPayload['permissions']['can_delete']);
        $this->assertSame('remix', $viewerPayload['permissions']['edit_mode']);
        $this->assertFalse($guestPayload['permissions']['can_edit']);
        $this->assertSame('none', $guestPayload['permissions']['edit_mode']);
    }

    public function test_serialize_for_library_list_omits_preview_url(): void
    {
        $owner = User::factory()->create([
            'nickname' => '목록유저',
        ]);
        $service = $this->app->make(AiAppService::class);

        $app = $service->store($owner->id, [
            'title' => '목록',
            'app_type' => 'general',
            'html' => '<!DOCTYPE html><html><head></head><body>list</body></html>',
            'metadata' => ['owner_nickname' => '목록유저'],
        ]);

        $listPayload = $service->serializeForLibraryList($app->fresh(['user']), $owner->id);
        $detailPayload = $service->serialize($app->fresh(['user']), includeHtml: false, viewerUserId: $owner->id);

        $this->assertArrayNotHasKey('preview_url', $listPayload);
        $this->assertArrayHasKey('preview_url', $detailPayload);
        $this->assertSame('목록유저', $listPayload['owner']['nickname']);
        $this->assertSame($app->id, $listPayload['id']);
    }

    public function test_list_for_user_uses_library_list_serialization(): void
    {
        $owner = User::factory()->create();
        $service = $this->app->make(AiAppService::class);

        $service->store($owner->id, [
            'title' => '내 앱',
            'app_type' => 'general',
            'html' => '<!DOCTYPE html><html><head></head><body>mine</body></html>',
        ]);

        $items = $service->listForUser($owner->id);
        $this->assertCount(1, $items);
        $this->assertArrayNotHasKey('preview_url', $items[0]);
        $this->assertSame('내 앱', $items[0]['title']);
    }

    public function test_store_allows_shared_app_as_remix_parent_for_other_user(): void
    {
        $owner = User::factory()->create();
        $remixer = User::factory()->create();
        $service = $this->app->make(AiAppService::class);

        $source = $service->store($owner->id, [
            'title' => '원본',
            'app_type' => 'general',
            'html' => '<!DOCTYPE html><html><head></head><body>source</body></html>',
            'is_shared' => true,
        ]);

        $remix = $service->store($remixer->id, [
            'title' => '리믹스',
            'app_type' => 'general',
            'html' => '<!DOCTYPE html><html><head></head><body>remix</body></html>',
            'parent_app_id' => $source->id,
            'metadata' => ['remix_source_id' => $source->id],
        ]);

        $this->assertSame($source->id, $remix->parent_app_id);
        $this->assertSame($remixer->id, $remix->user_id);
    }

    public function test_ai_app_service_update_for_user_updates_owned_app_only(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $service = $this->app->make(AiAppService::class);

        $app = $service->store($owner->id, [
            'title' => '원본',
            'app_type' => 'general',
            'html' => '<!DOCTYPE html><html><head></head><body>old</body></html>',
        ]);

        $updated = $service->updateForUser($owner->id, $app->id, [
            'title' => '수정됨',
            'app_type' => 'game',
            'html' => '<!DOCTYPE html><html><head></head><body>new</body></html>',
        ]);

        $this->assertNotNull($updated);
        $this->assertSame('수정됨', $updated->title);
        $this->assertSame('game', $updated->app_type);
        $this->assertNull($service->updateForUser($other->id, $app->id, [
            'title' => '침해',
            'app_type' => 'general',
            'html' => '<!DOCTYPE html><html><head></head><body>x</body></html>',
        ]));
    }

    public function test_store_website_link_persists_favicon_to_internal_storage(): void
    {
        Http::fake([
            'https://example.com/icon.png' => Http::response(
                "\x89PNG\r\n\x1a\n",
                200,
                ['Content-Type' => 'image/png'],
            ),
        ]);

        $user = User::factory()->create();
        $service = $this->app->make(AiAppService::class);

        $app = $service->store($user->id, [
            'title' => 'Example Site',
            'app_type' => 'website_link',
            'html' => '<!DOCTYPE html><html><head></head><body data-moabom-website-link="1"></body></html>',
            'metadata' => [
                'website_url' => 'https://example.com',
                'icon_url' => 'https://example.com/icon.png',
                'icon_from_title' => false,
            ],
        ]);

        $fresh = $app->fresh();
        $metadata = is_array($fresh->metadata) ? $fresh->metadata : [];
        $this->assertStringContainsString('/apps/generated/'.$fresh->id.'/website-icon', (string) ($metadata['icon_url'] ?? ''));
        $this->assertSame('https://example.com/icon.png', $metadata['icon_source_url'] ?? null);

        $iconStorage = $this->app->make(WebsiteLinkIconStorageService::class);
        $this->assertNotNull($iconStorage->storedIconPath((int) $fresh->id));

        $this->assertTrue($service->deleteForUser($user->id, $fresh->id));
        $this->assertNull($iconStorage->storedIconPath((int) $fresh->id));
    }

    public function test_hosted_system_prompt_requires_moabom_app_storage(): void
    {
        $service = $this->app->make(AiAppService::class);
        $prompt = $service->systemPromptForType('general', 'hosted');

        $this->assertStringContainsString('MoabomAppStorage', $prompt);
        $this->assertStringContainsString('whenReady', $prompt);
        $this->assertStringContainsString('Do NOT use raw localStorage/sessionStorage', $prompt);
    }
}
