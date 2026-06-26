<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Feature;

use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\System\Services\Shell\ShellUsageIngestGuard;
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
            ->assertJsonPath('data.period_hours', 0)
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

    public function test_app_rankings_report_change_from_recent_period(): void
    {
        $recentHour = now()->utc()->startOfHour()->toDateTimeString();
        $oldHour = now()->utc()->subHours(30)->startOfHour()->toDateTimeString();

        $this->withHeaders($this->usageIngestHeaders())
            ->postJson('/api/modules/moabom-system/public/shell/app-usage', [
                'events' => [
                    [
                        'app_id' => 'cpap-mask',
                        'bucket_hour' => $oldHour,
                        'open_hits' => 50,
                        'active_seconds' => 0,
                    ],
                    [
                        'app_id' => 'consulting',
                        'bucket_hour' => $recentHour,
                        'open_hits' => 5,
                        'active_seconds' => 200,
                    ],
                    [
                        'app_id' => 'cpap-mask',
                        'bucket_hour' => $recentHour,
                        'open_hits' => 1,
                        'active_seconds' => 10,
                    ],
                ],
            ])->assertOk();

        $items = $this->getJson('/api/modules/moabom-system/public/shell/rankings/apps?limit=30')
            ->assertOk()
            ->assertJsonPath('data.period_hours', 0)
            ->json('data.items');

        $this->assertNotEmpty($items);
        $this->assertSame('cpap-mask', $items[0]['app_id']);
        $this->assertSame('down', $items[0]['change']);

        $consulting = collect($items)->firstWhere('app_id', 'consulting');
        $this->assertNotNull($consulting);
        $this->assertSame(2, $consulting['rank']);
        $this->assertSame('up', $consulting['change']);
    }

    public function test_user_rankings_use_cumulative_ranking_points(): void
    {
        if (! Schema::hasTable('moabom_credit_balances')) {
            $this->artisan('migrate', [
                '--path' => base_path('modules/moabom-credit/database/migrations/2026_05_03_000001_create_moabom_credit_tables.php'),
                '--realpath' => true,
            ]);
        }

        if (! Schema::hasColumn('moabom_credit_balances', 'ranking_points')) {
            $this->artisan('migrate', [
                '--path' => base_path('modules/moabom-credit/database/migrations/2026_06_25_000001_add_ranking_points_to_moabom_credit_balances.php'),
                '--realpath' => true,
            ]);
        }

        $leader = User::factory()->create([
            'nickname' => 'Leader_User',
            'status' => UserStatus::Active->value,
        ]);
        $follower = User::factory()->create([
            'nickname' => 'Follower_User',
            'status' => UserStatus::Active->value,
        ]);

        $now = now();
        DB::table('moabom_credit_balances')->insert([
            [
                'user_id' => $leader->id,
                'balance' => 50,
                'ranking_points' => 50,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'user_id' => $follower->id,
                'balance' => 5,
                'ranking_points' => 5,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        $response = $this->getJson('/api/modules/moabom-system/public/shell/rankings/users?limit=5');
        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.period_hours', 0)
            ->assertJsonStructure([
                'data' => [
                    'items' => [
                        ['user_id', 'user_uuid', 'name', 'score', 'rank', 'change'],
                    ],
                ],
            ]);

        $items = $response->json('data.items');
        $this->assertNotEmpty($items);
        $this->assertSame($leader->id, $items[0]['user_id']);
        $this->assertSame($leader->uuid, $items[0]['user_uuid']);
        $this->assertSame(50, $items[0]['score']);
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
        if (Schema::hasTable('moabom_shell_user_usage_buckets')) {
            DB::table('moabom_shell_user_usage_buckets')->delete();
        }
        if (Schema::hasTable('moabom_credit_transactions')) {
            DB::table('moabom_credit_transactions')->delete();
        }
        if (Schema::hasTable('moabom_credit_balances')) {
            DB::table('moabom_credit_balances')->delete();
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
