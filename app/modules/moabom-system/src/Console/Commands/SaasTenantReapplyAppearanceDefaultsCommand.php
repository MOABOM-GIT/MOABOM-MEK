<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;
use Modules\Moabom\System\Saas\TenantProvisionAppearanceDefaultsApplier;
use Modules\Moabom\System\Saas\TenantRecord;

/**
 * legacy tenant — provision appearance snapshot(DB+GCS blob) 재적용.
 *
 * v158 이전 provision 등 appearance seed 미적용 테넌트 보정용 (삭제 대체).
 *
 * @see deploy/PROJECT-SAAS-HOSPITALS-REGISTRATION.md Phase E.8
 */
final class SaasTenantReapplyAppearanceDefaultsCommand extends Command
{
    protected $signature = 'moabom:saas:tenant-reapply-appearance-defaults
        {slug : 대상 tenant slug (* = 모든 active, purging 제외)}
        {--dry-run : 변경 없이 대상만 출력}';

    protected $description = 'tenant appearance provision defaults(DB+GCS seed blob) 재적용';

    public function handle(
        PlatformConnectionFactory $platformConnections,
        TenantProvisionAppearanceDefaultsApplier $applier,
    ): int {
        $platformConnections->registerConnection();

        $slugArg = strtolower(trim((string) $this->argument('slug')));
        $dryRun = (bool) $this->option('dry-run');

        $tenants = $this->loadTenants($slugArg);
        if ($tenants === []) {
            $this->error('대상 tenant 없음.');

            return self::FAILURE;
        }

        $this->line(sprintf('mode=%s targets=%d', $dryRun ? 'DRY-RUN' : 'APPLY', count($tenants)));

        $applied = 0;
        $errors = [];

        foreach ($tenants as $tenant) {
            $this->info(sprintf('=== %s (host=%s db=%s) ===', $tenant->slug, $tenant->host, $tenant->dbDatabase));

            if ($tenant->isPlatformHost()) {
                $this->warn('  skip: platform host');
                continue;
            }

            if ($tenant->isPurging()) {
                $this->warn('  skip: status=purging');
                continue;
            }

            if ($dryRun) {
                $this->line('  would reapply appearance defaults');
                $applied++;

                continue;
            }

            try {
                $applier->apply($tenant);
                $this->info('  appearance defaults 재적용 완료');
                $applied++;
            } catch (\Throwable $e) {
                $msg = sprintf('tenant=%s err=%s', $tenant->slug, $e->getMessage());
                $errors[] = $msg;
                $this->error('  '.$e->getMessage());
            }
        }

        $this->newLine();
        $this->line(sprintf('SUMMARY applied=%d errors=%d', $applied, count($errors)));

        return $errors === [] ? self::SUCCESS : self::FAILURE;
    }

    /**
     * @return list<TenantRecord>
     */
    private function loadTenants(string $slugArg): array
    {
        if ($slugArg === '*') {
            $rows = DB::connection('moabom_platform')
                ->table('moabom_saas_tenants')
                ->where('status', 'active')
                ->orderBy('slug')
                ->get();

            $tenants = [];
            foreach ($rows as $row) {
                $tenants[] = TenantRecord::fromRow((array) $row);
            }

            return $tenants;
        }

        $row = DB::connection('moabom_platform')
            ->table('moabom_saas_tenants')
            ->where('slug', $slugArg)
            ->first();

        return $row === null ? [] : [TenantRecord::fromRow((array) $row)];
    }
}
