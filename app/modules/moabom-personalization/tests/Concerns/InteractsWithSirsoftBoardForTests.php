<?php

namespace Modules\Moabom\Personalization\Tests\Concerns;

use App\Enums\ExtensionStatus;
use App\Models\Module;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Schema;

/**
 * moabom-personalization 테스트가 sirsoft-board 의 `boards`/`board_posts`/`board_comments`
 * 테이블을 즉석으로 마이그레이트하고 sirsoft-board 모듈을 active 로 시드한다.
 *
 * 이 trait 는 모듈간 결합을 테스트 영역에 한정한다. 운영 코드는 컨트롤러의
 * `Schema::hasTable()` 가드로 sirsoft-board 부재 상태를 graceful 처리한다.
 */
trait InteractsWithSirsoftBoardForTests
{
    protected static bool $boardMigrated = false;

    protected function ensureSirsoftBoardSchema(): void
    {
        if (static::$boardMigrated) {
            return;
        }

        $boardMigrationsPath = base_path('modules/sirsoft-board/database/migrations');
        if (! is_dir($boardMigrationsPath)) {
            $boardMigrationsPath = base_path('modules/_bundled/sirsoft-board/database/migrations');
        }

        if (
            is_dir($boardMigrationsPath)
            && (! Schema::hasTable('boards') || ! Schema::hasTable('board_posts') || ! Schema::hasTable('board_comments'))
        ) {
            $this->artisan('migrate', [
                '--path' => $boardMigrationsPath,
                '--realpath' => true,
            ]);
        }

        Module::firstOrCreate(
            ['identifier' => 'sirsoft-board'],
            [
                'vendor' => 'sirsoft',
                'name' => ['ko' => '게시판', 'en' => 'Board'],
                'status' => ExtensionStatus::Active->value,
                'version' => '1.0.0-beta.5',
                'config' => [],
            ]
        );

        static::$boardMigrated = true;
    }

    protected function createUserWithUserRole(string $language = 'ko'): User
    {
        $user = User::factory()->create(['language' => $language]);
        $role = Role::firstOrCreate(
            ['identifier' => 'user'],
            ['name' => ['ko' => '일반 사용자', 'en' => 'User']]
        );
        $user->roles()->syncWithoutDetaching([$role->id]);

        return $user->fresh();
    }
}
