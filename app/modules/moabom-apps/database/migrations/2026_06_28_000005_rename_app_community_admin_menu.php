<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * admin 메뉴 구 명칭(앱 이야기 관리) → 앱 리뷰 관리 SSOT 반영.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('menus')) {
            return;
        }

        $name = json_encode(
            ['ko' => '앱 리뷰 관리', 'en' => 'App Review Posts'],
            JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR,
        );

        DB::table('menus')
            ->where('slug', 'moabom-apps-community')
            ->update([
                'name' => $name,
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        if (! Schema::hasTable('menus')) {
            return;
        }

        $legacy = json_encode(
            ['ko' => '앱 이야기 관리', 'en' => 'App Community Posts'],
            JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR,
        );

        DB::table('menus')
            ->where('slug', 'moabom-apps-community')
            ->update([
                'name' => $legacy,
                'updated_at' => now(),
            ]);
    }
};
