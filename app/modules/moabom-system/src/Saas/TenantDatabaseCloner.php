<?php

namespace Modules\Moabom\System\Saas;

use PDO;

/**
 * 플랫폼/template DB → 테넌트 DB 구조·데이터 복제 (PDO, Laravel 부트스트랩 불필요).
 */
final class TenantDatabaseCloner
{
    /**
     * @return int 복제한 테이블 수
     */
    public function cloneDatabase(string $sourceDb, string $targetDb): int
    {
        if ($sourceDb === '' || $targetDb === '') {
            throw new \InvalidArgumentException('Source and target database names are required.');
        }

        if ($sourceDb === $targetDb) {
            throw new \InvalidArgumentException("Target must differ from source ({$sourceDb}).");
        }

        if (! preg_match('/^[a-zA-Z0-9_-]+$/', $sourceDb) || ! preg_match('/^[a-zA-Z0-9_-]+$/', $targetDb)) {
            throw new \InvalidArgumentException('Invalid database name.');
        }

        $pdo = $this->connect();
        $pdo->exec('SET FOREIGN_KEY_CHECKS=0');

        $tables = $pdo->query("SHOW TABLES FROM `{$sourceDb}`")->fetchAll(PDO::FETCH_COLUMN);
        if ($tables === []) {
            throw new \RuntimeException("No tables in source DB {$sourceDb}.");
        }

        foreach ($tables as $table) {
            $pdo->exec("DROP TABLE IF EXISTS `{$targetDb}`.`{$table}`");
            $pdo->exec("CREATE TABLE `{$targetDb}`.`{$table}` LIKE `{$sourceDb}`.`{$table}`");
            $pdo->exec("INSERT INTO `{$targetDb}`.`{$table}` SELECT * FROM `{$sourceDb}`.`{$table}`");
        }

        $pdo->exec('SET FOREIGN_KEY_CHECKS=1');

        return count($tables);
    }

    /**
     * 스키마만 복제 (데이터 INSERT 없음) — package seed provision v2.
     *
     * @return int 생성한 테이블 수
     */
    public function cloneSchemaOnly(string $sourceDb, string $targetDb): int
    {
        if ($sourceDb === '' || $targetDb === '') {
            throw new \InvalidArgumentException('Source and target database names are required.');
        }

        if ($sourceDb === $targetDb) {
            throw new \InvalidArgumentException("Target must differ from source ({$sourceDb}).");
        }

        if (! preg_match('/^[a-zA-Z0-9_-]+$/', $sourceDb) || ! preg_match('/^[a-zA-Z0-9_-]+$/', $targetDb)) {
            throw new \InvalidArgumentException('Invalid database name.');
        }

        $pdo = $this->connect();
        $pdo->exec('SET FOREIGN_KEY_CHECKS=0');

        $tables = $pdo->query("SHOW TABLES FROM `{$sourceDb}`")->fetchAll(PDO::FETCH_COLUMN);
        if ($tables === []) {
            throw new \RuntimeException("No tables in source DB {$sourceDb}.");
        }

        foreach ($tables as $table) {
            $pdo->exec("DROP TABLE IF EXISTS `{$targetDb}`.`{$table}`");
            $pdo->exec("CREATE TABLE `{$targetDb}`.`{$table}` LIKE `{$sourceDb}`.`{$table}`");
        }

        $pdo->exec('SET FOREIGN_KEY_CHECKS=1');

        return count($tables);
    }

    public function createDatabaseIfNotExists(string $database): void
    {
        if (! preg_match('/^[a-zA-Z0-9_-]+$/', $database)) {
            throw new \InvalidArgumentException('Invalid database name.');
        }

        $pdo = $this->connect();
        $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    }

    public function databaseExists(string $database): bool
    {
        if (! preg_match('/^[a-zA-Z0-9_-]+$/', $database)) {
            return false;
        }

        $pdo = $this->connect();
        $stmt = $pdo->prepare('SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?');
        $stmt->execute([$database]);

        return (bool) $stmt->fetchColumn();
    }

    public function dropDatabase(string $database): void
    {
        if (! preg_match('/^[a-zA-Z0-9_-]+$/', $database)) {
            throw new \InvalidArgumentException('Invalid database name.');
        }

        $pdo = $this->connect();
        $pdo->exec("DROP DATABASE IF EXISTS `{$database}`");
    }

    /** @internal package seed · Job cross-DB copy */
    public function pdo(): PDO
    {
        return $this->connect();
    }

    private function connect(): PDO
    {
        return SaasMysqlPdoFactory::connect();
    }
}
