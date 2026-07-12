<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;
use Modules\Moabom\System\Services\MoabomWarmTemplateLangStatic;

/**
 * nginx lang 정적 fast-path 용 병합 JSON warm (entrypoint 호출).
 */
class MoabomWarmTemplateLangStaticCommand extends Command
{
    protected $signature = 'moabom:warm-template-lang-static
                            {--template=* : 템플릿 id (기본 moabom-basic·moabom-admin_basic)}
                            {--locale=* : 로케일 (기본 ko/en/ja/zh)}';

    protected $description = '병합 template lang JSON 을 public/ext-static/lang 에 기록';

    public function handle(MoabomWarmTemplateLangStatic $warmer): int
    {
        $templates = array_values(array_filter(array_map('strval', (array) $this->option('template'))));
        $locales = array_values(array_filter(array_map('strval', (array) $this->option('locale'))));

        $result = $warmer->warm(
            $templates !== [] ? $templates : null,
            $locales !== [] ? $locales : null,
        );

        foreach ($result['written'] as $path) {
            $this->line("written: ext-static/{$path}");
        }
        foreach ($result['skipped'] as $path) {
            $this->warn("skipped: {$path}");
        }

        $this->info(sprintf(
            'warm-template-lang-static done (written=%d skipped=%d)',
            count($result['written']),
            count($result['skipped']),
        ));

        return self::SUCCESS;
    }
}
