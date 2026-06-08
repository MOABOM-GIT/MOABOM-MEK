<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;
use Modules\Moabom\System\Saas\PlatformRuntimeConfigurator;
use Modules\Moabom\System\Saas\TenantFilesystemConfigurator;
use Modules\Moabom\System\Saas\TenantRecord;
use Modules\Moabom\System\Saas\TenantRegistry;

/**
 * moabom_saas_tenants.display_name / region / address 를 tenant `settings/general.json` 기준으로 백필.
 *
 * 기존 freshent 등 platform 레지스트리에 display_name 이 NULL 인 행을 채운다.
 * site_description 은 "region · address" 형태로 join 되어 있어 자동 분리는 시도하지 않는다.
 *
 * 옵션:
 *   --apply    실제 UPDATE (기본 dry-run)
 *   --force    이미 값이 있는 행도 덮어쓰기
 *   --tenant=  특정 slug 만 처리
 */
final class SaasBackfillTenantDisplayCommand extends Command
{
    protected $signature = 'moabom:saas:backfill-tenant-display
        {--apply : 실제 UPDATE 반영 (기본 dry-run)}
        {--force : 이미 값이 있는 행도 덮어쓰기}
        {--tenant= : 특정 slug 만 처리}';

    protected $description = 'tenant general.json site_name → moabom_saas_tenants.display_name 백필';

    public function handle(
        PlatformConnectionFactory $platformConnections,
        TenantRegistry $registry,
        TenantFilesystemConfigurator $filesystemConfigurator,
        PlatformRuntimeConfigurator $platformRuntimeConfigurator,
    ): int {
        $platformConnections->registerConnection();

        if (! Schema::connection('moabom_platform')->hasColumn('moabom_saas_tenants', 'display_name')) {
            $this->error('moabom_saas_tenants.display_name 컬럼이 없습니다. 먼저 platform-migrate 를 실행하세요.');

            return self::FAILURE;
        }

        $apply = (bool) $this->option('apply');
        $force = (bool) $this->option('force');
        $only = strtolower(trim((string) $this->option('tenant')));

        $tenants = $registry->listActive();
        if ($tenants === []) {
            $this->warn('active tenant 가 없습니다.');

            return self::FAILURE;
        }

        $updated = 0;
        $skipped = 0;
        $failed = 0;

        foreach ($tenants as $tenant) {
            if ($only !== '' && $tenant->slug !== $only) {
                continue;
            }

            try {
                $filesystemConfigurator->apply($tenant);
                $general = $this->loadGeneralJson();
            } catch (\Throwable $e) {
                $this->warn("[{$tenant->slug}] general.json 로드 실패: ".$e->getMessage());
                $platformRuntimeConfigurator->applyPlatform();
                $failed++;
                continue;
            } finally {
                $platformRuntimeConfigurator->applyPlatform();
            }

            $siteName = trim((string) ($general['site_name'] ?? ''));
            if ($siteName === '') {
                $this->line("[{$tenant->slug}] site_name 없음 — skip");
                $skipped++;
                continue;
            }

            if (! $force && $tenant->displayName !== null && $tenant->displayName !== '') {
                $this->line("[{$tenant->slug}] display_name='{$tenant->displayName}' 이미 채워짐 — skip (--force 로 덮어쓰기)");
                $skipped++;
                continue;
            }

            $this->line(sprintf(
                '[%s] %s → %s',
                $tenant->slug,
                $tenant->displayName === null ? '∅' : "'{$tenant->displayName}'",
                "'{$siteName}'"
            ));

            if ($apply) {
                $this->updateRegistryRow($tenant, $siteName);
                $registry->forgetHostCache($tenant->host);
            }
            $updated++;
        }

        $mode = $apply ? '반영' : 'dry-run';
        $this->info("완료({$mode}): updated={$updated}, skipped={$skipped}, failed={$failed}");

        if (! $apply) {
            $this->warn('--apply 옵션으로 실제 UPDATE 를 반영하세요.');
        }

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }

    /**
     * @return array<string, mixed>
     */
    private function loadGeneralJson(): array
    {
        $disk = Storage::disk('settings');
        if (! $disk->exists('general.json')) {
            return [];
        }

        $raw = (string) $disk->get('general.json');
        if (trim($raw) === '') {
            return [];
        }

        $decoded = json_decode(ltrim($raw, "\xEF\xBB\xBF"), true);

        return is_array($decoded) ? $decoded : [];
    }

    private function updateRegistryRow(TenantRecord $tenant, string $siteName): void
    {
        DB::connection('moabom_platform')
            ->table('moabom_saas_tenants')
            ->where('slug', $tenant->slug)
            ->update([
                'display_name' => $siteName,
                'updated_at' => now(),
            ]);
    }
}
