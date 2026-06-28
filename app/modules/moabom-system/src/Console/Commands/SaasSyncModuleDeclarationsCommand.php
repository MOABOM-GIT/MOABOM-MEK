<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Modules\Moabom\System\Saas\TenantPackageCatalog;

/**
 * hospital-default.json module_sync_declarations → platform DB 권한·메뉴 동기화 SSOT.
 *
 * run-layout-sync-job 이 moabom-system·moabom-presence 만 sync 하면
 * moabom-apps.community.* 권한이 DB에 없어 admin layout·API 가 403 → 빈 화면이 된다.
 */
final class SaasSyncModuleDeclarationsCommand extends Command
{
    protected $signature = 'moabom:saas:sync-module-declarations
        {--package=hospital-default : SaaS 패키지 ID}
        {--module= : 단일 모듈 identifier; 생략 시 package SSOT 전체}';

    protected $description = '패키지 module_sync_declarations → moabom:module-sync-declarations (platform 권한·메뉴 SSOT)';

    public function handle(TenantPackageCatalog $catalog): int
    {
        $packageId = (string) $this->option('package');
        $moduleFilter = trim((string) ($this->option('module') ?? ''));

        try {
            $package = $catalog->get($packageId);
        } catch (\Throwable $exception) {
            $this->error("패키지를 읽을 수 없습니다: {$packageId} — {$exception->getMessage()}");

            return self::FAILURE;
        }

        $targets = $package->moduleSyncDeclarations;
        if ($moduleFilter !== '') {
            $targets = in_array($moduleFilter, $targets, true) ? [$moduleFilter] : [$moduleFilter];
        }

        if ($targets === []) {
            $this->warn('동기화할 module_sync_declarations 대상 없음');

            return self::SUCCESS;
        }

        $this->info('module declarations sync (package='.$packageId.'): '.implode(', ', $targets));

        $failures = 0;
        foreach ($targets as $identifier) {
            if (! File::exists(base_path("modules/{$identifier}/module.php"))) {
                $this->warn("  skip {$identifier} — module.php 없음");

                continue;
            }

            $this->line("  sync-declarations: {$identifier}");
            $exitCode = Artisan::call('moabom:module-sync-declarations', [
                'identifier' => $identifier,
            ]);
            $output = trim(Artisan::output());
            if ($output !== '') {
                $this->output->writeln($output);
            }

            if ($exitCode !== self::SUCCESS) {
                // filesystem 에 있으나 DB 미설치·비활성 모듈 — 전체 Job 중단 방지 (moabom-apps 등 선행 sync 보호)
                if (str_contains($output, '모듈을 찾을 수 없습니다')) {
                    $this->warn("  skip {$identifier} — DB 미설치/비활성 (filesystem only)");

                    continue;
                }

                $failures++;
            }
        }

        if ($failures > 0) {
            $this->error("module declarations sync 실패: {$failures}건");

            return self::FAILURE;
        }

        $this->info('module declarations sync 완료');

        return self::SUCCESS;
    }
}
