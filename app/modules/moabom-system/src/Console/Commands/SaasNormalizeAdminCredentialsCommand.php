<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use App\Models\Role;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\System\Saas\PlatformRuntimeConfigurator;
use Modules\Moabom\System\Saas\SaasAdminCredentials;
use Modules\Moabom\System\Saas\TenantDatabaseConfigurator;
use Modules\Moabom\System\Saas\TenantRecord;
use Modules\Moabom\System\Saas\TenantRegistry;

final class SaasNormalizeAdminCredentialsCommand extends Command
{
    protected $signature = 'moabom:saas:normalize-admin-credentials
        {target=all : all|platform|tenants|<tenant slug>}
        {--email=admin@mek360.com : 통일할 관리자 email}
        {--password=mek360 : 통일할 관리자 password}
        {--old-email=admin@moabom.com : 기존 관리자 email}
        {--name=관리자 : 관리자 표시 이름}
        {--nickname= : 관리자 nickname (테넌트는 미지정 시 병원명)}
        {--dry-run : 변경하지 않고 대상만 출력}';

    protected $description = 'SaaS platform 및 tenant 관리자 계정 email/password 통일';

    public function handle(
        PlatformRuntimeConfigurator $platformRuntimeConfigurator,
        TenantDatabaseConfigurator $tenantDatabaseConfigurator,
        TenantRegistry $registry,
    ): int {
        $target = strtolower((string) $this->argument('target'));
        $email = SaasAdminCredentials::email((string) $this->option('email'));
        $password = SaasAdminCredentials::password((string) $this->option('password'));
        $oldEmail = SaasAdminCredentials::email((string) $this->option('old-email'));
        $name = trim((string) $this->option('name')) ?: SaasAdminCredentials::DEFAULT_ADMIN_NAME;
        $nickname = trim((string) ($this->option('nickname') ?? ''));
        $dryRun = (bool) $this->option('dry-run');

        $summary = [];

        if ($target === 'all' || $target === 'platform') {
            $platformRuntimeConfigurator->applyPlatform();
            $summary[] = $this->normalizeCurrentDatabase('platform', $email, $password, $oldEmail, $name, $nickname, $dryRun);
        }

        if ($target === 'all' || $target === 'tenants') {
            foreach ($registry->listActive() as $tenant) {
                $tenantDatabaseConfigurator->apply($tenant);
                $summary[] = $this->normalizeCurrentDatabase(
                    $tenant->slug,
                    $email,
                    $password,
                    $oldEmail,
                    $name,
                    $nickname,
                    $dryRun,
                    $tenant,
                );
            }
        } elseif (! in_array($target, ['all', 'platform', 'tenants'], true)) {
            $tenant = $registry->findBySlug($target);
            if ($tenant === null) {
                $this->error("레지스트리에 없음: {$target}");

                return self::FAILURE;
            }

            $tenantDatabaseConfigurator->apply($tenant);
            $summary[] = $this->normalizeCurrentDatabase(
                $tenant->slug,
                $email,
                $password,
                $oldEmail,
                $name,
                $nickname,
                $dryRun,
                $tenant,
            );
        }

        $this->table(['target', 'database', 'action', 'email'], $summary);
        $this->info($dryRun ? 'dry-run 완료' : '관리자 계정 통일 완료');

        return self::SUCCESS;
    }

    /**
     * @return array{target: string, database: string, action: string, email: string}
     */
    private function normalizeCurrentDatabase(
        string $label,
        string $email,
        string $password,
        string $oldEmail,
        string $name,
        string $nickname,
        bool $dryRun,
        ?TenantRecord $tenant = null,
    ): array {
        $database = $tenant?->dbDatabase ?? (string) DB::connection()->getDatabaseName();
        $user = User::query()->where('email', $email)->first();
        $oldUser = $oldEmail !== $email
            ? User::query()->where('email', $oldEmail)->first()
            : null;

        $action = match (true) {
            $user !== null && $oldUser !== null => 'merge-old-admin',
            $user !== null => 'update-existing',
            $oldUser !== null => 'rename-old-admin',
            default => 'create-admin',
        };

        if (! $dryRun) {
            DB::transaction(function () use ($user, $oldUser, $email, $password, $name, $nickname, $tenant): void {
                $admin = $user ?? $oldUser ?? new User;
                $resolvedNickname = $this->resolveNickname($nickname, $tenant, $admin);
                $payload = [
                    'name' => $admin->name ?: $name,
                    'email' => $email,
                    'password' => $password,
                    'email_verified_at' => $admin->email_verified_at ?? now(),
                    'timezone' => $admin->timezone ?: 'Asia/Seoul',
                    'language' => $admin->language ?: 'ko',
                    'is_super' => true,
                    'status' => 'active',
                ];

                if ($resolvedNickname !== '' && Schema::hasColumn('users', 'nickname')) {
                    $payload['nickname'] = $resolvedNickname;
                }

                if (Schema::hasColumn('users', 'failed_login_attempts')) {
                    $payload['failed_login_attempts'] = 0;
                }
                if (Schema::hasColumn('users', 'locked_until')) {
                    $payload['locked_until'] = null;
                }
                if (Schema::hasColumn('users', 'last_failed_login_at')) {
                    $payload['last_failed_login_at'] = null;
                }

                $admin->forceFill($payload)->save();

                $this->ensureAdminRole($admin);

                if ($user !== null && $oldUser !== null && $oldUser->getKey() !== $admin->getKey()) {
                    $this->archiveDuplicateOldAdmin($oldUser, $email);
                }
            });
        }

        return [
            'target' => $label,
            'database' => $database,
            'action' => $action,
            'email' => $email,
        ];
    }

    private function ensureAdminRole(User $user): void
    {
        $role = Role::query()->where('identifier', 'admin')->first();
        if ($role === null) {
            return;
        }

        if (! $user->roles()->where('identifier', 'admin')->exists()) {
            $user->roles()->attach($role->id, ['assigned_at' => now()]);
        }
    }

    private function resolveNickname(string $nickname, ?TenantRecord $tenant, User $admin): string
    {
        if ($nickname !== '') {
            return $nickname;
        }

        if ($tenant !== null) {
            $tenantName = trim((string) ($tenant->displayName ?? ''));
            if ($tenantName !== '') {
                return $tenantName;
            }
        }

        return trim((string) ($admin->nickname ?? ''));
    }

    private function archiveDuplicateOldAdmin(User $user, string $email): void
    {
        $archiveEmail = sprintf('archived-%s-%s', $user->getKey(), $email);
        $payload = [
            'email' => $archiveEmail,
            'is_super' => false,
            'status' => 'inactive',
        ];

        if (Schema::hasColumn('users', 'locked_until')) {
            $payload['locked_until'] = now()->addYears(10);
        }

        $user->forceFill($payload)->save();
    }
}
