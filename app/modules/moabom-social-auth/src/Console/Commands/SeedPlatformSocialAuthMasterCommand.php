<?php

declare(strict_types=1);

namespace Modules\Moabom\Social\Auth\Console\Commands;

use Illuminate\Console\Command;
use Modules\Moabom\Social\Auth\Services\PlatformSocialAuthMasterSeeder;

class SeedPlatformSocialAuthMasterCommand extends Command
{
    protected $signature = 'moabom:social-auth:seed-platform-master
                            {--force : 기존 credential 이 있어도 env 값으로 덮어씁니다}';

    protected $description = '플랫폼 host(mek360.com) write DB에 SNS master credential·broker 설정을 시드합니다.';

    public function handle(PlatformSocialAuthMasterSeeder $seeder): int
    {
        $result = $seeder->seed((bool) $this->option('force'));

        foreach ($result['errors'] as $error) {
            $this->error($error);
        }

        if ($result['seeded'] !== []) {
            $this->info('Seeded: '.implode(', ', $result['seeded']));
        }

        if ($result['skipped'] !== []) {
            $this->line('Skipped: '.implode(', ', $result['skipped']));
        }

        if ($result['errors'] !== []) {
            return self::FAILURE;
        }

        if ($result['seeded'] === [] && $result['skipped'] === []) {
            $this->warn('No providers seeded. Set SOCIAL_AUTH_MASTER_* env vars or use --force.');

            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}
