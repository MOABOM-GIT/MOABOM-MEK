<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use PDO;

/**
 * Provision v2 — 플랫폼 schema source DB에서 코어 identity baseline만 복사.
 *
 * roles · permissions · role_permissions 전체 + admin 사용자 1명.
 * users·attachments·posts 등 테넌트 콘텐츠는 복제하지 않는다 (full clone 금지).
 */
final class TenantIdentityBootstrapper
{
    /** @var list<string> */
    private const BASELINE_TABLES = ['roles', 'permissions', 'role_permissions'];

    public function __construct(
        private readonly TenantDatabaseCloner $cloner,
    ) {}

    public function bootstrap(string $sourceDb, string $targetDb, string $adminEmail = 'admin@moabom.com'): void
    {
        $adminEmail = trim($adminEmail);
        if ($adminEmail === '') {
            $adminEmail = 'admin@moabom.com';
        }

        if (! $this->cloner->databaseExists($targetDb)) {
            throw new \RuntimeException("Target DB {$targetDb} does not exist.");
        }

        if (! $this->cloner->databaseExists($sourceDb)) {
            throw new \RuntimeException("Identity source DB {$sourceDb} does not exist.");
        }

        $pdo = $this->cloner->pdo();
        $pdo->exec('SET FOREIGN_KEY_CHECKS=0');

        try {
            $users = $this->t('users');
            $userRoles = $this->t('user_roles');

            foreach (['user_roles', 'role_permissions', 'users', 'permissions', 'roles'] as $table) {
                $pdo->exec("DELETE FROM `{$targetDb}`.`{$this->t($table)}`");
            }

            foreach (self::BASELINE_TABLES as $table) {
                $qualified = $this->t($table);
                $pdo->exec(
                    "INSERT INTO `{$targetDb}`.`{$qualified}` "
                    ."SELECT * FROM `{$sourceDb}`.`{$qualified}`"
                );
            }

            $stmt = $pdo->prepare(
                "INSERT INTO `{$targetDb}`.`{$users}` "
                ."SELECT * FROM `{$sourceDb}`.`{$users}` WHERE `email` = ?"
            );
            $stmt->execute([$adminEmail]);

            if ($stmt->rowCount() === 0) {
                throw new \RuntimeException("Identity source 에 admin 사용자 없음: {$adminEmail}");
            }

            $stmt = $pdo->prepare(
                "INSERT INTO `{$targetDb}`.`{$userRoles}` "
                ."SELECT ur.* FROM `{$sourceDb}`.`{$userRoles}` ur "
                ."INNER JOIN `{$sourceDb}`.`{$users}` u ON u.id = ur.user_id "
                ."WHERE u.email = ?"
            );
            $stmt->execute([$adminEmail]);
        } finally {
            $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
        }
    }

    private function t(string $table): string
    {
        return $this->tablePrefix().$table;
    }

    private function tablePrefix(): string
    {
        $connection = (string) config('database.default', 'mysql');

        return (string) config("database.connections.{$connection}.prefix", '');
    }
}
