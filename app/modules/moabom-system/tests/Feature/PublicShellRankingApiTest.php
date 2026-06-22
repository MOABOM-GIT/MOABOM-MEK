<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Feature;

use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\System\Services\Shell\ShellUsageIngestGuard;
use Modules\Moabom\System\Support\MoabomPublicApiCacheKeys;
use Modules\Moabom\System\Tests\ModuleTestCase;

class PublicShellRankingApiTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        if (! Schema::hasTable('moabom_shell_app_usage_buckets')) {
            $this->artisan('migrate', [
                '--path' => $this->getModuleBasePath().'/database/migrations/2026_06_21_000001_create_moabom_shell_ranking_tables.php',
                '--realpath' => true,
            ]);
        }

        if (! Schema::hasTable('moabom_shell_user_usage_buckets')) {
            $this->artisan('migrate', [
                '--path' => $this->getModuleBasePath().'/database/migrations/2026_06_21_000002_create_moabom_shell_user_usage_buckets_table.php',
                '--realpath' => true,
            ]);
        }
    }

    public function test_accepts_app_usage_events_and_returns_rankings(): void
    {
        $bucketHour = now()->utc()->startOfHour()->toDateTimeString();

        $this->withHeaders($this->usageIngestHeaders())
            ->postJson('/api/modules/moabom-system/public/shell/app-usage', [
                'events' => [
                    [
                        'app_id' => 'cpap-mask',
                        'bucket_hour' => $bucketHour,
                        'open_hits' => 2,
                        'active_seconds' => 30,
                    ],
                    [
                        'app_id' => 'consulting',
                        'bucket_hour' => $bucketHour,
                        'open_hits' => 1,
                        'active_seconds' => 120,
                    ],
                ],
            ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.accepted', 2);

        $response = $this->getJson('/api/modules/moabom-system/public/shell/rankings/apps?limit=30');
        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.period_hours', 24)
            ->assertJsonStructure([
                'data' => [
                    'items' => [
                        ['app_id', 'rank', 'change', 'open_hits', 'active_seconds', 'score'],
                    ],
                ],
            ]);

        $items = $response->json('data.items');
        $this->assertNotEmpty($items);
        $this->assertSame('consulting', $items[0]['app_id']);
    }

    public function test_app_rankings_report_change_from_previous_build(): void
    {
        Cache::put(MoabomPublicApiCacheKeys::shellRankingsPreviousRanks('apps'), [
            'consulting' => 2,
            'cpap-mask' => 1,
        ], 3600);

        $bucketHour = now()->utc()->startOfHour()->toDateTimeString();

        $this->withHeaders($this->usageIngestHeaders())
            ->postJson('/api/modules/moabom-system/public/shell/app-usage', [
                'events' => [
                    [
                        'app_id' => 'consulting',
                        'bucket_hour' => $bucketHour,
                        'open_hits' => 5,
                        'active_seconds' => 200,
                    ],
                    [
                        'app_id' => 'cpap-mask',
                        'bucket_hour' => $bucketHour,
                        'open_hits' => 1,
                        'active_seconds' => 10,
                    ],
                ],
            ])->assertOk();

        $items = $this->getJson('/api/modules/moabom-system/public/shell/rankings/apps?limit=30')
            ->assertOk()
            ->json('data.items');

        $this->assertNotEmpty($items);
        $this->assertSame('consulting', $items[0]['app_id']);
        $this->assertSame('up', $items[0]['change']);
    }

    public function test_user_rankings_use_activity_scores(): void
    {
        $leader = User::factory()->create([
            'nickname' => 'Leader_User',
            'status' => UserStatus::Active->value,
        ]);
        $follower = User::factory()->create([
            'nickname' => 'Follower_User',
            'status' => UserStatus::Active->value,
        ]);

        $bucketHour = now()->utc()->startOfHour()->toDateTimeString();

        DB::table('moabom_shell_user_usage_buckets')->insert([
            [
                'user_id' => $leader->id,
                'bucket_hour' => $bucketHour,
                'open_hits' => 5,
                'active_seconds' => 100,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'user_id' => $follower->id,
                'bucket_hour' => $bucketHour,
                'open_hits' => 1,
                'active_seconds' => 10,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $response = $this->getJson('/api/modules/moabom-system/public/shell/rankings/users?limit=5');
        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data' => [
                    'items' => [
                        ['user_id', 'name', 'score', 'rank', 'change'],
                    ],
                ],
            ]);

        $items = $response->json('data.items');
        $this->assertNotEmpty($items);
        $this->assertSame($leader->id, $items[0]['user_id']);
        $this->assertSame(150, $items[0]['score']);
        $this->assertSame(1, $items[0]['rank']);
    }

    public function test_authenticated_usage_ingest_records_user_buckets(): void
    {
        $user = User::factory()->create([
            'status' => UserStatus::Active->value,
        ]);

        $bucketHour = now()->utc()->startOfHour()->toDateTimeString();

        $this->actingAs($user, 'sanctum')
            ->withHeaders($this->usageIngestHeaders())
            ->postJson('/api/modules/moabom-system/public/shell/app-usage', [
                'events' => [
                    [
                        'app_id' => 'consulting',
                        'bucket_hour' => $bucketHour,
                        'open_hits' => 2,
                        'active_seconds' => 40,
                    ],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.accepted', 1);

        $this->assertDatabaseHas('moabom_shell_user_usage_buckets', [
            'user_id' => $user->id,
            'open_hits' => 2,
            'active_seconds' => 40,
        ]);
    }

    public function test_rejects_invalid_app_ids(): void
    {
        $this->withHeaders($this->usageIngestHeaders())
            ->postJson('/api/modules/moabom-system/public/shell/app-usage', [
                'events' => [
                    ['app_id' => '../../evil', 'open_hits' => 1],
                ],
            ])->assertStatus(422);
    }

    /**
     * @return array<string, string>
     */
    private function usageIngestHeaders(): array
    {
        $guard = app(ShellUsageIngestGuard::class);

        return [
            'X-Moabom-Shell-Usage-Token' => $guard->issueTokenForHour(now()->utc()->startOfHour()),
        ];
    }

    protected function tearDown(): void
    {
        Cache::forget(MoabomPublicApiCacheKeys::shellRankingsPreviousRanks('apps'));
        Cache::forget(MoabomPublicApiCacheKeys::shellRankingsPreviousRanks('users'));

        if (Schema::hasTable('moabom_shell_user_usage_buckets')) {
            DB::table('moabom_shell_user_usage_buckets')->delete();
        }
        if (Schema::hasTable('moabom_shell_app_usage_buckets')) {
            DB::table('moabom_shell_app_usage_buckets')->delete();
        }
        if (Schema::hasTable('moabom_shell_rank_snapshots')) {
            DB::table('moabom_shell_rank_snapshots')->delete();
        }

        parent::tearDown();
    }
}
