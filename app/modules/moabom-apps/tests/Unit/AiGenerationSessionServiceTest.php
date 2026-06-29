<?php

namespace Modules\Moabom\Apps\Tests\Unit;

use App\Models\User;
use Modules\Moabom\Apps\Models\AiGenerationSession;
use Modules\Moabom\Apps\Services\AiAppService;
use Modules\Moabom\Apps\Services\AiGenerationSessionService;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

class AiGenerationSessionServiceTest extends ModuleTestCase
{
    public function test_begin_creates_session_and_abandons_previous_active(): void
    {
        $user = User::factory()->create();
        $service = $this->app->make(AiGenerationSessionService::class);

        $first = $service->begin($user->id, [
            'prompt' => '첫 번째 앱',
            'app_type' => 'general',
            'model_id' => 'claude-sonnet',
        ]);
        $second = $service->begin($user->id, [
            'prompt' => '두 번째 앱',
            'app_type' => 'game',
            'model_id' => 'gpt-4o',
        ]);

        $this->assertNotSame($first->id, $second->id);
        $this->assertSame('abandoned', $first->fresh()?->status);
        $this->assertSame('streaming', $second->status);
    }

    public function test_begin_persists_form_context_for_resume(): void
    {
        $user = User::factory()->create();
        $service = $this->app->make(AiGenerationSessionService::class);

        $session = $service->begin($user->id, [
            'prompt' => '계산기 만들어줘',
            'title' => '내 계산기',
            'tier' => 'hosted',
            'app_type' => 'general',
            'model_id' => 'claude-sonnet',
        ]);

        $serialized = $service->serialize($session);

        $this->assertSame('내 계산기', $serialized['title']);
        $this->assertSame('계산기 만들어줘', $serialized['prompt']);
        $this->assertSame('hosted', $serialized['tier']);
    }

    public function test_serialize_falls_back_to_first_user_message_for_legacy_sessions(): void
    {
        $user = User::factory()->create();
        $service = $this->app->make(AiGenerationSessionService::class);

        $session = AiGenerationSession::query()->create([
            'user_id' => $user->id,
            'status' => 'paused',
            'app_type' => 'general',
            'model_id' => 'claude-sonnet',
            'partial_raw' => '<!DOCTYPE html><html><head></head><body>wip</body></html>',
            'messages' => [
                ['role' => 'user', 'content' => '레거시 프롬프트'],
                ['role' => 'assistant', 'content' => '<html></html>'],
            ],
        ]);

        $serialized = $service->serialize($session);

        $this->assertSame('레거시 프롬프트', $serialized['prompt']);
    }

    public function test_find_active_for_user_returns_latest_resumable_session(): void
    {
        $user = User::factory()->create();
        $service = $this->app->make(AiGenerationSessionService::class);

        AiGenerationSession::query()->create([
            'user_id' => $user->id,
            'status' => 'paused',
            'app_type' => 'general',
            'model_id' => 'claude-sonnet',
            'partial_raw' => '<!DOCTYPE html><html><head></head><body>wip</body></html>',
        ]);

        $active = $service->findActiveForUser($user->id);
        $this->assertNotNull($active);
        $this->assertSame('paused', $active->status);
    }

    public function test_find_active_for_user_includes_truncated_paused_sessions(): void
    {
        $user = User::factory()->create();
        $service = $this->app->make(AiGenerationSessionService::class);

        AiGenerationSession::query()->create([
            'user_id' => $user->id,
            'status' => 'paused',
            'app_type' => 'general',
            'model_id' => 'claude-sonnet',
            'partial_raw' => '<!DOCTYPE html><html><head></head><body>wip',
            'truncated' => true,
        ]);

        $active = $service->findActiveForUser($user->id);
        $this->assertNotNull($active);
        $this->assertTrue($active->truncated);
    }

    public function test_build_stream_result_keeps_partial_when_truncated_without_full_html(): void
    {
        $service = $this->app->make(AiAppService::class);

        $result = $service->buildStreamResult(
            ['prompt' => 'test', 'app_type' => 'general', 'model_id' => 'claude-sonnet'],
            '<!DOCTYPE html><html><head></head><body><p>partial',
            'anthropic',
            'claude-sonnet-4-20250514',
            true,
            'max_tokens',
        );

        $this->assertTrue($result['truncated']);
        $this->assertSame('', $result['html']);
        $this->assertStringContainsString('partial', (string) $result['raw']);
        $this->assertFalse($result['fallback']);
    }
}
