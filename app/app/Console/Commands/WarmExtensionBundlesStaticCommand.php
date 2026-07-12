<?php

namespace App\Console\Commands;

use App\Services\ExtensionBundleService;
use Illuminate\Console\Command;

/**
 * nginx 정적 경로용 확장 번들을 public/ext-static 에 게시합니다.
 */
class WarmExtensionBundlesStaticCommand extends Command
{
    protected $signature = 'ext-bundles:warm-static';

    protected $description = '확장 병합 번들을 public/ext-static 에 게시해 nginx 정적 서빙을 준비합니다';

    public function handle(ExtensionBundleService $service): int
    {
        $result = $service->warmPublicStaticBundles();
        $written = count($result['written']);
        $skipped = count($result['skipped']);

        $this->info("ext-static 번들 게시: written={$written}, skipped={$skipped}");
        if ($written > 0) {
            $this->line('  '.implode(', ', $result['written']));
        }
        if ($skipped > 0) {
            $this->warn('  skipped: '.implode(', ', $result['skipped']));
        }

        return self::SUCCESS;
    }
}
