<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use PDO;

/**
 * package 정의에 따라 플랫폼 DB → 테넌트 DB extension 메타만 복사.
 *
 * 금지: users·attachments·posts 등 테넌트 콘텐츠 테이블 복제 (full clone).
 * module:update/template:update --force 사용 안 함 — platform row copy + disk artisan sync.
 */
final class TenantPackageDatabaseSeeder
{
    public function __construct(
        private readonly TenantDatabaseCloner $cloner,
        private readonly TenantLanguagePackMirror $languagePackMirror,
    ) {}

    private function t(string $table): string
    {
        return $this->tablePrefix().$table;
    }

    private function tablePrefix(): string
    {
        $connection = (string) config('database.default', 'mysql');

        return (string) config("database.connections.{$connection}.prefix", '');
    }

    public function seed(string $sourceDb, string $targetDb, TenantPackage $package): void
    {
        if (! $this->cloner->databaseExists($targetDb)) {
            throw new \RuntimeException("Target DB {$targetDb} does not exist.");
        }

        if ($package->templates !== []) {
            $this->copyByIdentifiers($sourceDb, $targetDb, $this->t('templates'), 'identifier', $package->templates);
            $this->copyTemplateLayouts($sourceDb, $targetDb, $package->templates);
            $this->copyTemplateLayoutExtensions($sourceDb, $targetDb, $package->templates);
        }

        if ($package->modules !== []) {
            $this->copyByIdentifiers($sourceDb, $targetDb, $this->t('modules'), 'identifier', $package->modules);
        }

        if ($package->plugins !== []) {
            $this->copyByIdentifiers($sourceDb, $targetDb, $this->t('plugins'), 'identifier', $package->plugins);
        }

        $this->activatePackageExtensions($targetDb, $package);
        $this->applyActiveTemplateFlags($targetDb, $package);
        $this->languagePackMirror->mirrorFromPlatformDatabase($sourceDb, $targetDb, $package);
    }

    /**
     * @param  list<string>  $identifiers
     */
    private function copyByIdentifiers(
        string $sourceDb,
        string $targetDb,
        string $table,
        string $identifierColumn,
        array $identifiers,
    ): void {
        if ($identifiers === []) {
            return;
        }

        $pdo = $this->pdo();
        $placeholders = implode(', ', array_fill(0, count($identifiers), '?'));
        $sql = "INSERT INTO `{$targetDb}`.`{$table}` "
            ."SELECT * FROM `{$sourceDb}`.`{$table}` "
            ."WHERE `{$identifierColumn}` IN ({$placeholders})";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($identifiers);
    }

    private function activatePackageExtensions(string $targetDb, TenantPackage $package): void
    {
        $this->activateIdentifiers($targetDb, $this->t('modules'), $package->modules);
        $this->activateIdentifiers($targetDb, $this->t('plugins'), $package->plugins);
    }

    /**
     * @param  list<string>  $identifiers
     */
    private function activateIdentifiers(string $targetDb, string $table, array $identifiers): void
    {
        if ($identifiers === []) {
            return;
        }

        $pdo = $this->pdo();
        $placeholders = implode(', ', array_fill(0, count($identifiers), '?'));
        $stmt = $pdo->prepare(
            "UPDATE `{$targetDb}`.`{$table}` SET `status` = 'active' WHERE `identifier` IN ({$placeholders})"
        );
        $stmt->execute($identifiers);
    }

    /**
     * @param  list<string>  $templateIdentifiers
     */
    private function copyTemplateLayouts(string $sourceDb, string $targetDb, array $templateIdentifiers): void
    {
        if ($templateIdentifiers === []) {
            return;
        }

        $pdo = $this->pdo();
        $placeholders = implode(', ', array_fill(0, count($templateIdentifiers), '?'));
        $layouts = $this->t('template_layouts');
        $templates = $this->t('templates');
        $versions = $this->t('template_layout_versions');

        $sql = "INSERT INTO `{$targetDb}`.`{$layouts}` "
            ."SELECT tl.* FROM `{$sourceDb}`.`{$layouts}` tl "
            ."INNER JOIN `{$sourceDb}`.`{$templates}` t ON t.id = tl.template_id "
            ."WHERE t.identifier IN ({$placeholders})";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($templateIdentifiers);

        $versionSql = "INSERT INTO `{$targetDb}`.`{$versions}` "
            ."SELECT v.* FROM `{$sourceDb}`.`{$versions}` v "
            ."INNER JOIN `{$sourceDb}`.`{$layouts}` tl ON tl.id = v.layout_id "
            ."INNER JOIN `{$sourceDb}`.`{$templates}` t ON t.id = tl.template_id "
            ."WHERE t.identifier IN ({$placeholders})";

        $stmt = $pdo->prepare($versionSql);
        $stmt->execute($templateIdentifiers);
    }

    /**
     * @param  list<string>  $templateIdentifiers
     */
    private function copyTemplateLayoutExtensions(string $sourceDb, string $targetDb, array $templateIdentifiers): void
    {
        if ($templateIdentifiers === []) {
            return;
        }

        $pdo = $this->pdo();
        $placeholders = implode(', ', array_fill(0, count($templateIdentifiers), '?'));
        $extensions = $this->t('template_layout_extensions');
        $templates = $this->t('templates');

        $sql = "INSERT INTO `{$targetDb}`.`{$extensions}` "
            ."SELECT e.* FROM `{$sourceDb}`.`{$extensions}` e "
            ."INNER JOIN `{$sourceDb}`.`{$templates}` t ON t.id = e.template_id "
            ."WHERE t.identifier IN ({$placeholders})";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($templateIdentifiers);
    }

    private function applyActiveTemplateFlags(string $targetDb, TenantPackage $package): void
    {
        $pdo = $this->pdo();
        $templates = $this->t('templates');
        $pdo->exec("UPDATE `{$targetDb}`.`{$templates}` SET status = 'inactive'");

        foreach ([$package->activeUserTemplate => 'user', $package->activeAdminTemplate => 'admin'] as $identifier => $type) {
            if ($identifier === '') {
                continue;
            }

            $stmt = $pdo->prepare(
                "UPDATE `{$targetDb}`.`{$templates}` SET status = 'active' WHERE identifier = ? AND type = ?"
            );
            $stmt->execute([$identifier, $type]);
        }
    }

    private function pdo(): PDO
    {
        return $this->cloner->pdo();
    }
}
