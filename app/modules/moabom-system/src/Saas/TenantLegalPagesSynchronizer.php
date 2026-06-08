<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * platform(moabom-db) 발행 약관 페이지를 tenant DB 에 복제 — 셸 푸터 sirsoft-page API 404 방지.
 */
final class TenantLegalPagesSynchronizer
{
    public function __construct(
        private readonly TenantDatabaseConfigurator $databaseConfigurator,
        private readonly TenantContext $tenantContext,
        private readonly PlatformRuntimeConfigurator $platformRuntimeConfigurator,
    ) {}

    /**
     * @return array{synced: int, inserted: int, updated: int, errors: list<string>}
     */
    public function syncForTenant(TenantRecord $tenant, ?string $sourceDb = null): array
    {
        $sourceDb = $sourceDb ?: (string) config('moabom-system.saas.provision.schema_source_db', 'moabom-db');
        $inserted = 0;
        $updated = 0;
        $errors = [];

        if ($sourceDb === '' || ! Schema::hasTable('pages')) {
            return ['synced' => 0, 'inserted' => 0, 'updated' => 0, 'errors' => ['pages 테이블 없음']];
        }

        $this->databaseConfigurator->apply($tenant);
        $this->tenantContext->setTenant($tenant, $tenant->host);

        try {
            $tenantDb = $tenant->dbDatabase;
            $pdo = DB::connection()->getPdo();
            $prefix = (string) DB::connection()->getTablePrefix();
            $pagesTable = $prefix.'pages';
            $versionsTable = $prefix.'page_versions';

            foreach (TenantLegalPageReader::LEGAL_SLUGS as $slug) {
                try {
                    $result = $this->syncSlug(
                        pdo: $pdo,
                        sourceDb: $sourceDb,
                        tenantDb: $tenantDb,
                        pagesTable: $pagesTable,
                        versionsTable: $versionsTable,
                        slug: $slug,
                    );
                    $inserted += $result['inserted'];
                    $updated += $result['updated'];
                } catch (\Throwable $e) {
                    $errors[] = sprintf('%s/%s: %s', $tenant->slug, $slug, $e->getMessage());
                }
            }
        } finally {
            $this->platformRuntimeConfigurator->applyPlatform();
        }

        return [
            'synced' => $inserted + $updated,
            'inserted' => $inserted,
            'updated' => $updated,
            'errors' => $errors,
        ];
    }

    /**
     * @return array{inserted: int, updated: int}
     */
    private function syncSlug(
        \PDO $pdo,
        string $sourceDb,
        string $tenantDb,
        string $pagesTable,
        string $versionsTable,
        string $slug,
    ): array {
        $stmt = $pdo->prepare(
            "SELECT * FROM `{$sourceDb}`.`{$pagesTable}` WHERE `slug` = ? AND `published` = 1 AND `deleted_at` IS NULL LIMIT 1"
        );
        $stmt->execute([$slug]);
        $source = $stmt->fetch(\PDO::FETCH_ASSOC);
        if (! is_array($source)) {
            throw new \RuntimeException("source published page 없음 ({$sourceDb})");
        }

        $existingStmt = $pdo->prepare(
            "SELECT `id` FROM `{$tenantDb}`.`{$pagesTable}` WHERE `slug` = ? AND `deleted_at` IS NULL LIMIT 1"
        );
        $existingStmt->execute([$slug]);
        $existingId = $existingStmt->fetchColumn();

        $pageColumns = array_values(array_diff(
            array_keys($source),
            ['id', 'created_at', 'updated_at', 'deleted_at'],
        ));

        if ($existingId === false) {
            $columns = array_merge($pageColumns, ['created_at', 'updated_at']);
            $placeholders = implode(',', array_fill(0, count($columns), '?'));
            $columnSql = '`'.implode('`,`', $columns).'`';
            $values = [];
            foreach ($pageColumns as $column) {
                $values[] = $source[$column];
            }
            $now = now()->toDateTimeString();
            $values[] = $now;
            $values[] = $now;

            $insert = $pdo->prepare("INSERT INTO `{$tenantDb}`.`{$pagesTable}` ({$columnSql}) VALUES ({$placeholders})");
            $insert->execute($values);
            $pageId = (int) $pdo->lastInsertId();
            $this->syncVersions($pdo, $sourceDb, $tenantDb, $versionsTable, (int) $source['id'], $pageId);

            return ['inserted' => 1, 'updated' => 0];
        }

        $setParts = [];
        $values = [];
        foreach ($pageColumns as $column) {
            $setParts[] = "`{$column}` = ?";
            $values[] = $source[$column];
        }
        $values[] = now()->toDateTimeString();
        $values[] = (int) $existingId;

        $update = $pdo->prepare(
            'UPDATE `'.$tenantDb.'`.`'.$pagesTable.'` SET '.implode(', ', $setParts).', `updated_at` = ? WHERE `id` = ?'
        );
        $update->execute($values);
        $this->syncVersions($pdo, $sourceDb, $tenantDb, $versionsTable, (int) $source['id'], (int) $existingId);

        return ['inserted' => 0, 'updated' => 1];
    }

    private function syncVersions(
        \PDO $pdo,
        string $sourceDb,
        string $tenantDb,
        string $versionsTable,
        int $sourcePageId,
        int $tenantPageId,
    ): void {
        if (! Schema::hasTable('page_versions')) {
            return;
        }

        $pdo->prepare("DELETE FROM `{$tenantDb}`.`{$versionsTable}` WHERE `page_id` = ?")->execute([$tenantPageId]);

        $stmt = $pdo->prepare("SELECT * FROM `{$sourceDb}`.`{$versionsTable}` WHERE `page_id` = ? ORDER BY `version`");
        $stmt->execute([$sourcePageId]);
        while (($row = $stmt->fetch(\PDO::FETCH_ASSOC)) !== false) {
            if (! is_array($row)) {
                continue;
            }
            unset($row['id']);
            $row['page_id'] = $tenantPageId;
            $columns = array_keys($row);
            $placeholders = implode(',', array_fill(0, count($columns), '?'));
            $sql = 'INSERT INTO `'.$tenantDb.'`.`'.$versionsTable.'` (`'.implode('`,`', $columns).'`) VALUES ('.$placeholders.')';
            $insert = $pdo->prepare($sql);
            $insert->execute(array_values($row));
        }
    }
}
