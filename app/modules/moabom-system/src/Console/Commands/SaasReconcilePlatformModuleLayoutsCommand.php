<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use App\Services\ModuleService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Modules\Moabom\System\Saas\ModuleLayoutSyncCatalog;
use Modules\Moabom\System\Saas\PlatformModuleLayoutReconciler;
use Modules\Moabom\System\Saas\PlatformRuntimeConfigurator;

/**
 * platform DB module layouts — filesystem 정합·override purge·검증 (배포마다 1회).
 *
 * 전체 module layout sync(RF-13)와 분리되어 hash 게이트 없이 매 배포 실행된다.
 */
final class SaasReconcilePlatformModuleLayoutsCommand extends Command
{
    protected $signature = 'moabom:saas:reconcile-platform-module-layouts
        {--module= : 모듈 identifier; 생략·* = layout JSON 보유 활성 모듈 전체}';

    protected $description = 'platform module layouts filesystem 정합·검증 (배포 SSOT)';

    public function handle(
        PlatformRuntimeConfigurator $platformRuntimeConfigurator,
        ModuleService $moduleService,
        PlatformModuleLayoutReconciler $reconciler,
    ): int {
        $platformRuntimeConfigurator->applyPlatform();

        $moduleOption = $this->option('module');
        if (is_array($moduleOption)) {
            $moduleOption = '*';
        }
        $moduleOption = (string) ($moduleOption ?? '*');
        if ($moduleOption === '') {
            $moduleOption = '*';
        }

        $moduleIds = ModuleLayoutSyncCatalog::resolveModuleOption($moduleOption);
        if ($moduleIds === []) {
            $this->warn('reconcile 대상 module layout 없음');

            return self::SUCCESS;
        }

        $this->info('=== platform module layouts refresh ===');
        $this->line('targets: '.implode(', ', $moduleIds));

        foreach ($moduleIds as $moduleId) {
            $refresh = $moduleService->refreshModuleLayouts($moduleId);
            if ($refresh === null) {
                $this->error("module:refresh-layout({$moduleId}) 실패");

                return self::FAILURE;
            }

            $this->line(sprintf(
                '  [%s] created=%d updated=%d deleted=%d',
                $moduleId,
                (int) ($refresh['created'] ?? 0),
                (int) ($refresh['updated'] ?? 0),
                (int) ($refresh['deleted'] ?? 0),
            ));
        }

        $report = $reconciler->reconcilePlatform($moduleOption === '*' ? null : $moduleOption, 'platform');
        foreach ($report->messages as $message) {
            if (str_contains($message, 'layout OK')) {
                $this->line('  '.$message);
            } elseif (str_contains($message, '제거') || str_contains($message, '삭제') || str_contains($message, '강제 반영')) {
                $this->warn('  '.$message);
            } elseif (! str_contains($message, '검증 생략')) {
                $this->line('  '.$message);
            }
        }

        if (! $report->ok) {
            $failed = array_keys(array_filter(
                $report->layouts,
                static fn (array $entry): bool => ! $entry['ok'],
            ));
            $this->error('platform module layout reconcile 실패: '.implode(', ', $failed));

            return self::FAILURE;
        }

        Artisan::call('template:cache-clear', [], $this->output);

        $this->info(sprintf('✅ platform module layout reconcile 완료 (%d layout)', count($report->layouts)));

        return self::SUCCESS;
    }
}
