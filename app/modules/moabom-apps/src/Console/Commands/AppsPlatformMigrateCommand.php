<?php

namespace Modules\Moabom\Apps\Console\Commands;

use Illuminate\Console\Command;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;

class AppsPlatformMigrateCommand extends Command
{
    protected $signature = 'moabom:apps:platform-migrate {--force : 운영 환경에서도 실행}';

    protected $description = '생성앱 platform DB(moabom-platform) 마이그레이션';

    public function handle(): int
    {
        GeneratedAppsConnection::register();

        $path = base_path('modules/moabom-apps/database/migrations/platform');
        if (! is_dir($path)) {
            $this->error("마이그레이션 경로 없음: {$path}");

            return self::FAILURE;
        }

        $this->call('migrate', [
            '--database' => GeneratedAppsConnection::NAME,
            '--path' => 'modules/moabom-apps/database/migrations/platform',
            '--force' => $this->option('force'),
        ]);

        $this->info('생성앱 platform 마이그레이션 완료.');

        return self::SUCCESS;
    }
}
