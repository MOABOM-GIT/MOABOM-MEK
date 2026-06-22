<?php

namespace Modules\Moabom\Presence\Console\Commands;

use Illuminate\Console\Command;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;

class PresencePlatformMigrateCommand extends Command
{
    protected $signature = 'moabom:presence:platform-migrate {--force : 운영 환경에서도 실행}';

    protected $description = '접속자 platform DB(moabom-platform) 마이그레이션';

    public function handle(PlatformConnectionFactory $platformConnections): int
    {
        $platformConnections->registerConnection();

        $path = base_path('modules/moabom-presence/database/migrations/platform');
        if (! is_dir($path)) {
            $this->error("마이그레이션 경로 없음: {$path}");

            return self::FAILURE;
        }

        $this->call('migrate', [
            '--database' => 'moabom_platform',
            '--path' => 'modules/moabom-presence/database/migrations/platform',
            '--force' => $this->option('force'),
        ]);

        $this->info('접속자 platform 마이그레이션 완료.');

        return self::SUCCESS;
    }
}
