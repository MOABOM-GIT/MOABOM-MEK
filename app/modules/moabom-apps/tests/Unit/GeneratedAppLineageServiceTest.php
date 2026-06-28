<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Tests\Unit;

use App\Models\User;
use Modules\Moabom\Apps\Enums\GeneratedAppVisibility;
use Modules\Moabom\Apps\Services\GeneratedAppLineageService;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

class GeneratedAppLineageServiceTest extends ModuleTestCase
{
    public function test_creators_returns_original_then_remix_owners_in_order(): void
    {
        $originalOwner = User::factory()->create(['nickname' => '원작자']);
        $remixOwner = User::factory()->create(['nickname' => '리믹서']);

        $original = GeneratedAppsConnection::apps()->create([
            'user_id' => $originalOwner->id,
            'tenant_slug' => 'default',
            'title' => 'Original',
            'app_type' => 'general',
            'html' => '<html><body>o</body></html>',
            'visibility' => GeneratedAppVisibility::Global->value,
            'is_shared' => true,
        ]);

        $remix = GeneratedAppsConnection::apps()->create([
            'user_id' => $remixOwner->id,
            'tenant_slug' => 'default',
            'title' => 'Remix',
            'app_type' => 'general',
            'html' => '<html><body>r</body></html>',
            'visibility' => GeneratedAppVisibility::Global->value,
            'is_shared' => true,
            'parent_app_id' => $original->id,
        ]);

        /** @var GeneratedAppLineageService $service */
        $service = $this->app->make(GeneratedAppLineageService::class);
        $creators = $service->creatorsForApp((int) $remix->id);

        $this->assertCount(2, $creators);
        $this->assertSame('original', $creators[0]['role']);
        $this->assertSame((int) $original->id, $creators[0]['generated_app_id']);
        $this->assertSame('원작자', $creators[0]['owner']['nickname']);
        $this->assertFalse($creators[0]['is_current']);

        $this->assertSame('remix', $creators[1]['role']);
        $this->assertSame((int) $remix->id, $creators[1]['generated_app_id']);
        $this->assertSame('리믹서', $creators[1]['owner']['nickname']);
        $this->assertTrue($creators[1]['is_current']);
    }

    public function test_creators_returns_multi_step_remix_lineage_in_order(): void
    {
        $originalOwner = User::factory()->create(['nickname' => 'A']);
        $firstRemixer = User::factory()->create(['nickname' => 'B']);
        $secondRemixer = User::factory()->create(['nickname' => 'C']);

        $original = GeneratedAppsConnection::apps()->create([
            'user_id' => $originalOwner->id,
            'tenant_slug' => 'default',
            'title' => 'A App',
            'app_type' => 'general',
            'html' => '<html><body>a</body></html>',
            'visibility' => GeneratedAppVisibility::Global->value,
            'is_shared' => true,
        ]);

        $firstRemix = GeneratedAppsConnection::apps()->create([
            'user_id' => $firstRemixer->id,
            'tenant_slug' => 'default',
            'title' => 'B App',
            'app_type' => 'general',
            'html' => '<html><body>b</body></html>',
            'visibility' => GeneratedAppVisibility::Global->value,
            'is_shared' => true,
            'parent_app_id' => $original->id,
        ]);

        $secondRemix = GeneratedAppsConnection::apps()->create([
            'user_id' => $secondRemixer->id,
            'tenant_slug' => 'default',
            'title' => 'C App',
            'app_type' => 'general',
            'html' => '<html><body>c</body></html>',
            'visibility' => GeneratedAppVisibility::Global->value,
            'is_shared' => true,
            'parent_app_id' => $firstRemix->id,
        ]);

        /** @var GeneratedAppLineageService $service */
        $service = $this->app->make(GeneratedAppLineageService::class);
        $creators = $service->creatorsForApp((int) $secondRemix->id);

        $this->assertSame(['A', 'B', 'C'], array_column(array_column($creators, 'owner'), 'nickname'));
        $this->assertSame(['original', 'remix', 'remix'], array_column($creators, 'role'));
        $this->assertFalse($creators[0]['is_current']);
        $this->assertFalse($creators[1]['is_current']);
        $this->assertTrue($creators[2]['is_current']);
    }

    public function test_single_app_without_parent_has_one_original_creator(): void
    {
        $owner = User::factory()->create(['nickname' => '단독']);

        $app = GeneratedAppsConnection::apps()->create([
            'user_id' => $owner->id,
            'tenant_slug' => 'default',
            'title' => 'Solo',
            'app_type' => 'general',
            'html' => '<html><body>s</body></html>',
            'visibility' => GeneratedAppVisibility::Global->value,
            'is_shared' => true,
        ]);

        /** @var GeneratedAppLineageService $service */
        $service = $this->app->make(GeneratedAppLineageService::class);
        $creators = $service->creatorsForApp((int) $app->id);

        $this->assertCount(1, $creators);
        $this->assertSame('original', $creators[0]['role']);
        $this->assertTrue($creators[0]['is_current']);
    }
}
