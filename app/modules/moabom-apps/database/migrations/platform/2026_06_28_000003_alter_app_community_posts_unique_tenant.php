<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 플랫폼 DB — 앱 이야기 unique 를 (app, author tenant, user, type) 로 확장.
 *
 * idempotent 가드: 구버전 인덱스(app_user_type)가 있을 때만 drop, 신버전
 * 인덱스(app_tenant_user_type)가 없을 때만 add. create 마이그레이션이 이미
 * 신버전으로 테이블을 만든 fresh 환경에서 존재하지 않는 인덱스를 drop 하려다
 * platform-migrate 전체가 중단되던 문제를 구조적으로 제거한다.
 */
return new class extends Migration
{
    protected $connection = 'moabom_platform';

    private const TABLE = 'moabom_app_community_posts';

    private const LEGACY_INDEX = 'moabom_app_comm_posts_app_user_type_uniq';

    private const TENANT_INDEX = 'moabom_app_comm_posts_app_tenant_user_type_uniq';

    public function up(): void
    {
        if (! Schema::connection($this->connection)->hasTable(self::TABLE)) {
            return;
        }

        Schema::connection($this->connection)->table(self::TABLE, function (Blueprint $table): void {
            if ($this->indexExists(self::LEGACY_INDEX)) {
                $table->dropUnique(self::LEGACY_INDEX);
            }

            if (! $this->indexExists(self::TENANT_INDEX)) {
                $table->unique(
                    ['generated_app_id', 'tenant_slug', 'user_id', 'post_type'],
                    self::TENANT_INDEX,
                );
            }
        });
    }

    public function down(): void
    {
        if (! Schema::connection($this->connection)->hasTable(self::TABLE)) {
            return;
        }

        Schema::connection($this->connection)->table(self::TABLE, function (Blueprint $table): void {
            if ($this->indexExists(self::TENANT_INDEX)) {
                $table->dropUnique(self::TENANT_INDEX);
            }

            if (! $this->indexExists(self::LEGACY_INDEX)) {
                $table->unique(
                    ['generated_app_id', 'user_id', 'post_type'],
                    self::LEGACY_INDEX,
                );
            }
        });
    }

    private function indexExists(string $indexName): bool
    {
        $connection = Schema::connection($this->connection)->getConnection();

        $rows = $connection->select(
            'SELECT 1 FROM information_schema.statistics '
            .'WHERE table_schema = ? AND table_name = ? AND index_name = ? LIMIT 1',
            [$connection->getDatabaseName(), self::TABLE, $indexName],
        );

        return $rows !== [];
    }
};
