<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;
use Modules\Moabom\System\Saas\PlatformRuntimeConfigurator;
use Modules\Moabom\System\Saas\TenantDatabaseConfigurator;
use Modules\Moabom\System\Saas\TenantFilesystemConfigurator;
use Modules\Moabom\System\Saas\TenantModuleCategoryJsonStore;
use Modules\Moabom\System\Saas\TenantRecord;

/**
 * platform · 모든 active tenant 의 module_settings(appearance.font_size_default) 일괄 갱신.
 *
 * 운영 SaaS 의 module settings 라우터(SSOT) → DB row(`module_settings.payload` JSON).
 * stored 다른 키(point_color_presets / home_background_items / themes 등)는 그대로 보존하고
 * `font_size_default` 한 키만 머지 후 TenantModuleCategoryJsonStore::replace 로 atomic 덮어쓰기.
 *
 * SystemSettingsService::replaceSettings 우회 이유:
 *   - Cloud Run Job 컨텍스트 전환 후 BaseModuleServiceProvider contextual binding 이
 *     ModuleManager->getModule('moabom-system')->getStorage() 를 호출하는데, job 환경에서
 *     모듈 인스턴스가 null 반환하는 케이스 → null->getStorage() fatal.
 *   - frontend_defaults_revision bump 는 생략. admin UI 는 매 요청 fresh fetch 라
 *     사용자/관리자 모두 다음 페이지 로드 시 새 값을 즉시 본다.
 *
 * @see modules/moabom-system/src/Saas/TenantModuleCategoryJsonStore.php
 */
final class SaasSetTenantFontSizeDefaultCommand extends Command
{
    protected $signature = 'moabom:saas:set-tenant-font-size-default
        {target : 대상 (all = platform + 모든 active tenant | platform | <tenant slug>) — Cloud Run Job RF-12 가드로 literal * 미허용 → all 사용}
        {--level=2 : 적용할 font_size_default 단계 (1~5)}
        {--dry-run : 변경 없이 대상만 출력}';

    protected $description = 'platform·tenant 의 appearance.font_size_default 일괄 설정 (admin/사용자 디폴트 정렬)';

    public function handle(
        PlatformConnectionFactory $platformConnections,
        PlatformRuntimeConfigurator $platformRuntime,
        TenantFilesystemConfigurator $tenantFs,
        TenantDatabaseConfigurator $tenantDb,
    ): int {
        $platformConnections->registerConnection();

        $level = (int) $this->option('level');
        if ($level < 1 || $level > 5) {
            $this->error('--level 은 1~5 범위만 허용.');

            return self::FAILURE;
        }

        $dryRun = (bool) $this->option('dry-run');
        $targetArg = strtolower(trim((string) $this->argument('target')));

        $targets = $this->resolveTargets($targetArg);
        if ($targets === []) {
            $this->error('대상 없음.');

            return self::FAILURE;
        }

        $this->line(sprintf('mode=%s level=%d targets=%d', $dryRun ? 'DRY-RUN' : 'APPLY', $level, count($targets)));

        $applied = 0;
        $skipped = 0;
        $errors = [];

        foreach ($targets as $target) {
            $this->info('=== '.$target['label'].' ===');

            try {
                if ($target['kind'] === 'platform') {
                    $platformRuntime->applyPlatform();
                } else {
                    /** @var TenantRecord $tenant */
                    $tenant = $target['tenant'];
                    $tenantFs->apply($tenant);
                    $tenantDb->apply($tenant);
                }

                app()->forgetInstance(TenantModuleCategoryJsonStore::class);

                $store = app(TenantModuleCategoryJsonStore::class);
                $stored = $store->read('appearance');
                $current = isset($stored['font_size_default']) ? (int) $stored['font_size_default'] : null;

                if ($current === $level) {
                    $this->line(sprintf('  skip: 이미 font_size_default=%d', $level));
                    $skipped++;

                    continue;
                }

                if ($dryRun) {
                    $this->line(sprintf('  would change font_size_default %s → %d',
                        $current === null ? '(unset)' : (string) $current, $level));
                    $applied++;

                    continue;
                }

                $merged = $stored;
                $merged['font_size_default'] = $level;

                $ok = $store->replace('appearance', $merged);

                if (! $ok) {
                    throw new \RuntimeException('TenantModuleCategoryJsonStore::replace returned false');
                }

                $this->info(sprintf('  applied: font_size_default %s → %d',
                    $current === null ? '(unset)' : (string) $current, $level));
                $applied++;
            } catch (\Throwable $e) {
                $msg = sprintf('target=%s err=%s', $target['label'], $e->getMessage());
                $errors[] = $msg;
                $this->error('  '.$e->getMessage());
            } finally {
                $platformRuntime->applyPlatform();
            }
        }

        $this->newLine();
        $this->line(sprintf('SUMMARY applied=%d skipped=%d errors=%d', $applied, $skipped, count($errors)));

        return $errors === [] ? self::SUCCESS : self::FAILURE;
    }

    /**
     * @return list<array{kind: string, label: string, tenant?: TenantRecord}>
     */
    private function resolveTargets(string $arg): array
    {
        if ($arg === 'platform') {
            return [['kind' => 'platform', 'label' => 'platform']];
        }

        if ($arg === '*' || $arg === 'all') {
            $targets = [['kind' => 'platform', 'label' => 'platform']];
            $rows = DB::connection('moabom_platform')
                ->table('moabom_saas_tenants')
                ->where('status', 'active')
                ->orderBy('slug')
                ->get();

            foreach ($rows as $row) {
                $tenant = TenantRecord::fromRow((array) $row);
                if ($tenant->isPlatformHost() || $tenant->isPurging()) {
                    continue;
                }

                $targets[] = [
                    'kind' => 'tenant',
                    'tenant' => $tenant,
                    'label' => sprintf('%s (host=%s db=%s)', $tenant->slug, $tenant->host, $tenant->dbDatabase),
                ];
            }

            return $targets;
        }

        $row = DB::connection('moabom_platform')
            ->table('moabom_saas_tenants')
            ->where('slug', $arg)
            ->first();

        if ($row === null) {
            return [];
        }

        $tenant = TenantRecord::fromRow((array) $row);

        return [[
            'kind' => 'tenant',
            'tenant' => $tenant,
            'label' => sprintf('%s (host=%s db=%s)', $tenant->slug, $tenant->host, $tenant->dbDatabase),
        ]];
    }
}
