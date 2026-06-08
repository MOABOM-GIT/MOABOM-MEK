<?php

declare(strict_types=1);

namespace Modules\Moabom\Social\Auth\Console\Commands;

use Illuminate\Console\Command;
use Modules\Moabom\Social\Auth\Services\SocialAuthSettingsService;

class EnsureSocialAuthDefaultsCommand extends Command
{
    protected $signature = 'moabom:social-auth:ensure-defaults';

    protected $description = '현재 DB connection에 SNS provider 기본 row를 보장합니다.';

    public function handle(SocialAuthSettingsService $settingsService): int
    {
        $providers = $settingsService->getSettings('providers');

        if ($providers === []) {
            $this->error('SNS 설정 로드에 실패했습니다. social_auth_settings migration을 확인하세요.');

            return self::FAILURE;
        }

        $this->info('SNS provider defaults ensured.');
        $this->line(sprintf(
            'google:%s kakao:%s naver:%s',
            ($providers['google_enabled'] ?? false) ? 'enabled' : 'disabled',
            ($providers['kakao_enabled'] ?? false) ? 'enabled' : 'disabled',
            ($providers['naver_enabled'] ?? false) ? 'enabled' : 'disabled',
        ));

        return self::SUCCESS;
    }
}
