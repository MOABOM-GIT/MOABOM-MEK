<?php

namespace Modules\Moabom\Apps\Console\Commands;

use Illuminate\Console\Command;
use Modules\Moabom\Apps\Support\GeneratedAppLegacyVisibilityRepair;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;

class AppsRepairLegacyGlobalVisibilityCommand extends Command
{
    protected $signature = 'moabom:apps:repair-legacy-global-visibility
                            {--dry-run : 변경 없이 대상 건수만 출력}
                            {--force : 운영 환경에서도 실행}';

    protected $description = '레거시 visibility=global(구 is_shared) 을 tenant_slug 업체 범위로 1회 정리';

    public function handle(GeneratedAppLegacyVisibilityRepair $repair): int
    {
        GeneratedAppsConnection::register();

        if (! GeneratedAppsConnection::usesPlatformStore()) {
            $this->warn('platform 생성앱 store 미사용 — 건너뜀.');

            return self::SUCCESS;
        }

        if ($this->laravel->environment('production') && ! $this->option('force')) {
            $this->error('운영 환경에서는 --force 가 필요합니다.');

            return self::FAILURE;
        }

        $dryRun = (bool) $this->option('dry-run');
        $result = $repair->downgradeGlobalToTenant($dryRun);

        if ($dryRun) {
            $this->info("dry-run: global→tenant 대상 {$result['matched']}건");
        } else {
            $this->info("global→tenant 정리 완료: {$result['updated']}건 (대상 {$result['matched']}건)");
        }

        return self::SUCCESS;
    }
}
