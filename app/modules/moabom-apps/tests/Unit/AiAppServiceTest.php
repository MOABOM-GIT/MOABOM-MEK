<?php

namespace Modules\Moabom\Apps\Tests\Unit;

use App\Models\User;
use Modules\Moabom\Apps\Services\AiAppService;
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
        $this->assertDatabaseHas('moabom_system_generated_apps', [
            'id' => $app->id,
            'user_id' => $user->id,
            'app_type' => 'general',
        ]);
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
        $this->assertStringContainsString("frame-ancestors 'none'", (string) $app->html);
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
}
