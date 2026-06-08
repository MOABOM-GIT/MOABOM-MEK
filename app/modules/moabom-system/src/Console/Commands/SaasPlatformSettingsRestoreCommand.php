<?php

namespace Modules\Moabom\System\Console\Commands;

use App\Contracts\Repositories\ConfigRepositoryInterface;
use Illuminate\Console\Command;
use Modules\Moabom\System\Repositories\MoabomJsonConfigRepository;
use Modules\Moabom\System\Saas\PlatformRuntimeConfigurator;

class SaasPlatformSettingsRestoreCommand extends Command
{
    protected $signature = 'moabom:saas:platform-settings-restore
        {--site-name= : site_name 강제 덮어쓰기 (미지정 시 기존 값 유지)}
        {--site-url= : site_url 강제 (미지정 시 https://{base_domain})}
        {--description= : site_description 강제 (미지정 시 기존 값 유지)}';

    protected $description = '플랫폼(mek360.com) G7 general.json — site_url·prefix 오염 복구 (site_name 은 기본 유지)';

    public function handle(
        ConfigRepositoryInterface $configRepository,
        PlatformRuntimeConfigurator $platformRuntime,
    ): int {
        if (! config('moabom-system.saas.enabled')) {
            $this->warn('MOABOM_SAAS_ENABLED=false');
        }

        $platformRuntime->applyPlatform();

        $base = (string) config('moabom-system.saas.base_domain', 'mek360.com');
        $siteUrl = (string) ($this->option('site-url') ?: 'https://'.$base);

        $existing = $configRepository->getCategory('general');
        $patch = [
            'site_url' => $siteUrl,
            'timezone' => $existing['timezone'] ?? 'Asia/Seoul',
            'language' => $existing['language'] ?? 'ko',
            'currency' => $existing['currency'] ?? 'KRW',
        ];

        if ($this->option('site-name') !== null && $this->option('site-name') !== '') {
            $patch['site_name'] = (string) $this->option('site-name');
        }

        if ($this->option('description') !== null && $this->option('description') !== '') {
            $patch['site_description'] = (string) $this->option('description');
        }

        $merged = array_merge($existing, $patch);

        $saved = $configRepository->saveCategory('general', $merged);

        if (! $saved) {
            $this->error('general.json 저장 실패');

            return self::FAILURE;
        }

        if ($configRepository instanceof MoabomJsonConfigRepository) {
            Cache::forget('g7_json_settings_category:general');
        }

        $this->info('플랫폼 general 복구: site_url='.$siteUrl.' site_name='.($merged['site_name'] ?? '(empty)'));

        return self::SUCCESS;
    }
}
