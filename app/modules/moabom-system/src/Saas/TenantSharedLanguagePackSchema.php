<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use Illuminate\Support\Facades\DB;
use PDO;

/**
 * A안 — language_packs 카탈로그 read-through SSOT (그누보드7 코어 무수정).
 *
 * 배경: 언어팩 번역 **파일**은 컨테이너 이미지 전역 공유(`base_path('lang-packs/')`)인데,
 * 카탈로그 행(`language_packs` 테이블)만 테넌트 DB 복사본이라 mirror 가 필요했고
 * 그 mirror 누락/지연이 "테넌트만 언어팩 비어있음"(RF-19b)을 반복시켰다.
 *
 * 해결: 테넌트 DB 의 `language_packs` 를 **platform 테이블을 가리키는 MySQL VIEW** 로 만든다.
 *   - 같은 MySQL 인스턴스 cross-DB 이므로 (mirror 도 이미 cross-DB 사용) 비용 없이 동작.
 *   - `SELECT *` 단일 테이블 VIEW → 읽기/쓰기(install/activate) 모두 platform 으로 routing
 *     = 카탈로그 단일 SSOT. mirror 불필요. 코어(`LanguagePackRepository` 등) 무수정.
 *   - 외래키 없음(검증 완료) → TABLE↔VIEW 전환 안전.
 *   - 런타임 번역은 파일 경로 기반 + 시더가 활성 팩 파일을 읽어 테넌트별 라벨 적용 →
 *     카탈로그가 전역이어도 테넌트별 적용 흐름(provision/repair 시더)은 그대로 유지.
 *
 * 안전장치: `moabom-system.saas.shared_language_packs` 플래그(기본 false). false 면
 * 본 서비스는 호출되지 않고 기존 mirror 경로가 유지된다(즉시 롤백 가능).
 *
 * @see deploy/TENANT-EXPERIENCE-ARCHITECTURE.md §A
 * @see deploy/DEPLOY-RECURRING-FAILURES.md RF-19b
 */
final class TenantSharedLanguagePackSchema
{
    private const TABLE_BASE = 'language_packs';

    public function isEnabled(): bool
    {
        return (bool) config('moabom-system.saas.shared_language_packs', false);
    }

    /**
     * DB_PREFIX(g7_) 를 적용한 실제 물리 테이블명. raw SQL 은 Eloquent prefix 를 자동
     * 적용하지 않으므로 반드시 직접 붙여야 한다(미적용 시 g7_language_packs 를 못 찾음).
     */
    private function table(): string
    {
        $connection = (string) config('database.default', 'mysql');
        $prefix = (string) config("database.connections.{$connection}.prefix", '');

        return $prefix.self::TABLE_BASE;
    }

    private function backupTable(): string
    {
        return $this->table().'_premirror_bak';
    }

    /**
     * 현재 연결(tenant DB)의 language_packs 를 platform 테이블을 가리키는 VIEW 로 보장한다.
     * idempotent — 이미 VIEW 면 정의만 최신화, BASE TABLE 이면 tenant-only 행을 platform 으로
     * 승격(promote) 후 DROP TABLE → CREATE VIEW.
     *
     * @return array{action: string, promoted: int}
     */
    public function ensureViewForTenantDb(string $tenantDb, string $platformDb): array
    {
        $tenantDb = trim($tenantDb);
        $platformDb = trim($platformDb);
        if ($tenantDb === '' || $platformDb === '' || $tenantDb === $platformDb) {
            return ['action' => 'skipped', 'promoted' => 0];
        }

        $pdo = DB::connection()->getPdo();
        $table = $this->table();

        if (! $this->objectExists($pdo, $platformDb, $table)) {
            // platform 테이블이 없으면(설치 전) 아무 것도 하지 않는다.
            return ['action' => 'skipped_no_platform_table', 'promoted' => 0];
        }

        $type = $this->objectType($pdo, $tenantDb, $table);

        if ($type === 'VIEW') {
            $this->createOrReplaceView($pdo, $tenantDb, $platformDb);

            return ['action' => 'view_refreshed', 'promoted' => 0];
        }

        if ($type !== 'BASE TABLE') {
            // 객체 없음 → VIEW 신규 생성 (실패해도 잃을 것 없음).
            $this->createOrReplaceView($pdo, $tenantDb, $platformDb);

            return ['action' => 'view_created', 'promoted' => 0];
        }

        // 데이터 손실 방지: platform 에 없는 tenant-only 행을 identifier 기준으로 승격.
        $promoted = $this->promoteTenantOnlyRows($pdo, $tenantDb, $platformDb);

        // 크래시-세이프 전환: DROP→CREATE 사이 실패 시 language_packs 가 사라지면 admin 이
        // 더 악화된다. RENAME 으로 원본을 backup 으로 옮긴 뒤 VIEW 생성, 실패하면 즉시 복원한다.
        $bak = $this->backupTable();
        $pdo->exec("DROP TABLE IF EXISTS `{$tenantDb}`.`{$bak}`");
        $pdo->exec("RENAME TABLE `{$tenantDb}`.`{$table}` TO `{$tenantDb}`.`{$bak}`");
        try {
            $this->createOrReplaceView($pdo, $tenantDb, $platformDb);
        } catch (\Throwable $e) {
            // 복원: VIEW 생성 실패(예: CREATE VIEW 권한 부족) → 원본 테이블 그대로 되돌림.
            $pdo->exec("DROP VIEW IF EXISTS `{$tenantDb}`.`{$table}`");
            $pdo->exec("RENAME TABLE `{$tenantDb}`.`{$bak}` TO `{$tenantDb}`.`{$table}`");

            throw $e;
        }
        $pdo->exec("DROP TABLE IF EXISTS `{$tenantDb}`.`{$bak}`");

        return ['action' => 'table_to_view', 'promoted' => $promoted];
    }

    /**
     * 롤백: VIEW → BASE TABLE (platform 스키마 복제 + 데이터 복사). 이후 mirror 경로로 복귀.
     *
     * @return array{action: string, copied: int}
     */
    public function revertToTableForTenantDb(string $tenantDb, string $platformDb): array
    {
        $tenantDb = trim($tenantDb);
        $platformDb = trim($platformDb);
        if ($tenantDb === '' || $platformDb === '' || $tenantDb === $platformDb) {
            return ['action' => 'skipped', 'copied' => 0];
        }

        $pdo = DB::connection()->getPdo();
        $table = $this->table();
        $type = $this->objectType($pdo, $tenantDb, $table);
        if ($type !== 'VIEW') {
            return ['action' => 'not_a_view', 'copied' => 0];
        }

        $pdo->exec("DROP VIEW `{$tenantDb}`.`{$table}`");
        // 구조(인덱스·auto_increment 포함) 복제 후 데이터 복사.
        $pdo->exec("CREATE TABLE `{$tenantDb}`.`{$table}` LIKE `{$platformDb}`.`{$table}`");
        $stmt = $pdo->query(
            "INSERT INTO `{$tenantDb}`.`{$table}` SELECT * FROM `{$platformDb}`.`{$table}`"
        );
        $copied = $stmt !== false ? (int) $stmt->rowCount() : 0;

        return ['action' => 'view_to_table', 'copied' => $copied];
    }

    /**
     * 현재 연결의 language_packs 가 platform 을 가리키는 VIEW 인지.
     */
    public function isSharedView(string $tenantDb): bool
    {
        return $this->objectType(DB::connection()->getPdo(), trim($tenantDb), $this->table()) === 'VIEW';
    }

    private function createOrReplaceView(PDO $pdo, string $tenantDb, string $platformDb): void
    {
        $table = $this->table();
        $pdo->exec(
            "CREATE OR REPLACE VIEW `{$tenantDb}`.`{$table}` AS "
            ."SELECT * FROM `{$platformDb}`.`{$table}`"
        );
    }

    /**
     * platform 에 없는 tenant-only 행(identifier 기준)을 platform 으로 INSERT (id 제외, IGNORE).
     */
    private function promoteTenantOnlyRows(PDO $pdo, string $tenantDb, string $platformDb): int
    {
        $table = $this->table();
        $columns = $this->columnsWithoutId($pdo, $platformDb, $table);
        if ($columns === []) {
            return 0;
        }
        $colList = '`'.implode('`,`', $columns).'`';

        $sql = "INSERT IGNORE INTO `{$platformDb}`.`{$table}` ({$colList}) "
            ."SELECT {$colList} FROM `{$tenantDb}`.`{$table}` t "
            ."WHERE NOT EXISTS (SELECT 1 FROM `{$platformDb}`.`{$table}` p WHERE p.`identifier` = t.`identifier`)";

        $stmt = $pdo->query($sql);

        return $stmt !== false ? (int) $stmt->rowCount() : 0;
    }

    /**
     * @return 'BASE TABLE'|'VIEW'|null
     */
    private function objectType(PDO $pdo, string $schema, string $name): ?string
    {
        $stmt = $pdo->prepare(
            'SELECT TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1'
        );
        $stmt->execute([$schema, $name]);
        $type = $stmt->fetchColumn();

        return $type === false ? null : (string) $type;
    }

    private function objectExists(PDO $pdo, string $schema, string $name): bool
    {
        return $this->objectType($pdo, $schema, $name) !== null;
    }

    /**
     * @return list<string>
     */
    private function columnsWithoutId(PDO $pdo, string $schema, string $name): array
    {
        $stmt = $pdo->prepare(
            'SELECT COLUMN_NAME FROM information_schema.COLUMNS '
            .'WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME <> ? ORDER BY ORDINAL_POSITION'
        );
        $stmt->execute([$schema, $name, 'id']);

        $cols = [];
        while (($col = $stmt->fetchColumn()) !== false) {
            $cols[] = (string) $col;
        }

        return $cols;
    }
}
