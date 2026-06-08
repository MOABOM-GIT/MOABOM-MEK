<?php

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;

class SaasPlatformMigrateCommand extends Command
{
    protected $signature = 'moabom:saas:platform-migrate {--force : 운영 환경에서도 실행}';

    protected $description = 'SaaS 플랫폼 레지스트리 DB(moabom_saas_tenants) 마이그레이션';

    public function handle(PlatformConnectionFactory $platformConnections): int
    {
        $platformConnections->registerConnection();

        $path = base_path('modules/moabom-system/database/migrations/platform');
        if (! is_dir($path)) {
            $this->error("마이그레이션 경로 없음: {$path}");

            return self::FAILURE;
        }

        $this->call('migrate', [
            '--database' => 'moabom_platform',
            '--path' => 'modules/moabom-system/database/migrations/platform',
            '--force' => $this->option('force'),
        ]);

        $this->info('플랫폼 레지스트리 마이그레이션 완료.');

        return self::SUCCESS;
    }
}
