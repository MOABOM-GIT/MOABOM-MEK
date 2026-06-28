<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Tests\Unit;

use App\Models\User;
use Modules\Moabom\Apps\Enums\AppCommunityPostStatus;
use Modules\Moabom\Apps\Enums\AppCommunityPostType;
use Modules\Moabom\Apps\Enums\GeneratedAppVisibility;
use Modules\Moabom\Apps\Services\AppCommunityNotificationDataService;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

class AppCommunityNotificationDataServiceTest extends ModuleTestCase
{
    public function test_extract_data_targets_app_owner_for_new_review(): void
    {
        $owner = User::factory()->create(['nickname' => '제작자']);
        $reviewer = User::factory()->create(['nickname' => '리뷰어']);

        $app = GeneratedAppsConnection::apps()->create([
            'user_id' => $owner->id,
            'tenant_slug' => 'default',
            'title' => '리뷰 받을 앱',
            'app_type' => 'general',
            'html' => '<html><body>app</body></html>',
            'visibility' => GeneratedAppVisibility::Global->value,
            'is_shared' => true,
        ]);

        $post = GeneratedAppsConnection::communityPosts()->create([
            'generated_app_id' => $app->id,
            'tenant_slug' => 'default',
            'user_id' => $reviewer->id,
            'post_type' => AppCommunityPostType::Review->value,
            'rating' => 5,
            'title' => '좋은 앱입니다',
            'body' => '리뷰 본문',
            'status' => AppCommunityPostStatus::Published->value,
        ]);

        /** @var AppCommunityNotificationDataService $service */
        $service = $this->app->make(AppCommunityNotificationDataService::class);
        $extracted = $service->extractData(
            ['notifiable' => null, 'notifiables' => null, 'data' => [], 'context' => []],
            'app_review_created',
            [$post, $app],
        );

        $this->assertSame('리뷰 받을 앱', $extracted['data']['app_title']);
        $this->assertSame('리뷰어', $extracted['data']['review_author']);
        $this->assertSame($reviewer->id, $extracted['context']['trigger_user_id']);
        $this->assertSame($owner->id, $extracted['notifiables'][0]->id);
        $this->assertSame($owner->id, $extracted['context']['related_users']['app_owner']->id);
    }
}
