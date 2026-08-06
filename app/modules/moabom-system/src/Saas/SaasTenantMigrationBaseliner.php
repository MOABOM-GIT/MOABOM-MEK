<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PDO;
use Throwable;

/**
 * 테넌트 DB migrations 카탈로그 baseline.
 *
 * schema-only clone 후 migrations row 가 비어 있으면 create_* 재실행으로 실패한다.
 * - copyCatalog: source → target 전체 migrations row 복사 (provision 전용)
 * - baselineExistingCreates: Schema::create 대상 테이블이 이미 있을 때만 row INSERT
 *   (ALTER 는 INSERT 하지 않음 — pending migrate 가 적용해야 함)
 */
final class SaasTenantMigrationBaseliner
{
    public function __construct(
        private readonly TenantDatabaseCloner $cloner,
    ) {}

    /**
     * source DB 의 migrations 테이블 row 를 target 에 복사 (테이블 구조는 이미 있다고 가정).
     *
     * @return int 삽입 시도 행 수
     */
    public function copyCatalog(string $sourceDb, string $targetDb): int
    {
        $this->assertDbName($sourceDb);
        $this->assertDbName($targetDb);

        $pdo = $this->cloner->pdo();
        $table = $this->migrationsTableName($pdo, $sourceDb);
        if ($table === null) {
            return 0;
        }

        $this->ensureMigrationsTable($pdo, $sourceDb, $targetDb, $table);

        $sql = "INSERT IGNORE INTO `{$targetDb}`.`{$table}` (`id`, `migration`, `batch`) "
            ."SELECT `id`, `migration`, `batch` FROM `{$sourceDb}`.`{$table}`";
        try {
            return (int) $pdo->exec($sql);
        } catch (Throwable) {
            // id 충돌·컬럼 차이 — migration+batch 만
            $sql = "INSERT IGNORE INTO `{$targetDb}`.`{$table}` (`migration`, `batch`) "
                ."SELECT `migration`, `batch` FROM `{$sourceDb}`.`{$table}`";

            return (int) $pdo->exec($sql);
        }
    }

    /**
     * 현재 연결(tenant) 에서 create_* 이고 테이블이 이미 있는 migration 만 카탈로그에 INSERT.
     * ALTER/addColumn 계열은 넣지 않는다 (미적용 DDL 을 “적용됨”으로 위장하면 RF-32 drift 가 고착됨).
     *
     * @param  string  $migrationsRelativePath  base_path 상대 (예: database/migrations)
     * @return int 추가된 행 수
     */
    public function baselineExistingCreates(string $migrationsRelativePath): int
    {
        $absolute = base_path($migrationsRelativePath);
        if (! is_dir($absolute)) {
            return 0;
        }

        $maxBatch = (int) (DB::table('migrations')->max('batch') ?: 0);
        $batch = max(1, $maxBatch);
        $added = 0;

        foreach (glob($absolute.DIRECTORY_SEPARATOR.'*.php') ?: [] as $file) {
            $base = basename($file, '.php');
            if (DB::table('migrations')->where('migration', $base)->exists()) {
                continue;
            }

            $contents = (string) file_get_contents($file);
            if (! preg_match('/Schema::create\(\s*[\'"]([^\'"]+)[\'"]/', $contents, $m)) {
                continue;
            }
            $table = $m[1];
            if (! Schema::hasTable($table)) {
                continue;
            }

            DB::table('migrations')->insert([
                'migration' => $base,
                'batch' => $batch,
            ]);
            $added++;
        }

        return $added;
    }

    public function isAlreadyAppliedSqlState(string $sqlState, string $message): bool
    {
        $messageLower = strtolower($message);
        if (in_array($sqlState, ['42S01', '42S21'], true)) {
            return true;
        }
        if (str_contains($messageLower, 'already exists')) {
            return true;
        }
        if (str_contains($messageLower, 'duplicate column')) {
            return true;
        }
        if (str_contains($messageLower, 'duplicate key name')) {
            return true;
        }
        // DROP COLUMN/INDEX 가 이미 없는 경우 (테넌트 스키마 drift catch-up)
        if (str_contains($messageLower, "can't drop")
            || str_contains($messageLower, 'check that column/key exists')
            || (str_contains($messageLower, 'unknown column') && str_contains($messageLower, 'drop'))) {
            return true;
        }
        // shared language_packs 등 VIEW 에 ALTER 시도 (A안 read-through)
        if (str_contains($messageLower, 'is not base table')) {
            return true;
        }
        // 파티션 없는 테이블에 REMOVE PARTITIONING (sirsoft-board catch-up)
        if (str_contains($messageLower, 'not partitioned')) {
            return true;
        }

        return false;
    }

    private function migrationsTableName(PDO $pdo, string $db): ?string
    {
        $prefix = (string) config('database.connections.'.config('database.default').'.prefix', '');
        $candidates = array_values(array_unique(array_filter([
            $prefix !== '' ? $prefix.'migrations' : null,
            'migrations',
            'g7_migrations',
        ])));

        foreach ($candidates as $name) {
            $stmt = $pdo->prepare(
                'SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1'
            );
            $stmt->execute([$db, $name]);
            if ($stmt->fetchColumn()) {
                return $name;
            }
        }

        return null;
    }

    private function ensureMigrationsTable(PDO $pdo, string $sourceDb, string $targetDb, string $table): void
    {
        $stmt = $pdo->prepare(
            'SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1'
        );
        $stmt->execute([$targetDb, $table]);
        if ($stmt->fetchColumn()) {
            return;
        }

        $pdo->exec("CREATE TABLE `{$targetDb}`.`{$table}` LIKE `{$sourceDb}`.`{$table}`");
    }

    private function assertDbName(string $database): void
    {
        if (! preg_match('/^[a-zA-Z0-9_-]+$/', $database)) {
            throw new \InvalidArgumentException('Invalid database name.');
        }
    }
}
