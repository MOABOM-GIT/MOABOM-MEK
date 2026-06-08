<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use App\Models\Template;
use App\Models\TemplateLayout;
use App\Services\LanguagePackService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;
use Modules\Moabom\System\Saas\PlatformRuntimeConfigurator;
use Modules\Moabom\System\Saas\TenantContext;
use Modules\Moabom\System\Saas\TenantDatabaseConfigurator;
use Modules\Moabom\System\Saas\TenantRecord;

/**
 * Tenant 런타임 정합성 단일 진입점 (B안 — 통합 Reconciler).
 *
 * 배경: 그동안 "배포 후 테넌트가 마스터와 같은 상태가 되도록" 하는 작업이
 * 여러 명령(sync-template-layouts / sync-module-layouts / sync-tenant-admin-menus /
 * sync-tenant-language-packs / template:cache-clear)으로 흩어져 있었고,
 * entrypoint·Cloud Run Job·provision 마다 `|| true` 로 실패가 조용히 묻혀
 * "한 곳을 고치면 다른 테넌트가 깨지는" 두더지잡기를 유발했다.
 *
 * 본 명령은:
 *  1. 위 동기화 단계를 **고정된 순서로 한 번에** 실행한다 (각 단계는 기존 명령에 위임 — 동작 동일).
 *  2. 각 단계의 실패를 **집계**하고 비정상 종료 코드를 반환한다 (silent 실패 제거).
 *  3. 동기화 후 **실제 사용자 표면을 검증**한다:
 *       - 환경설정 > 언어팩 탭이 비어있지 않은지 (번들 18종이 항상 보여야 정상)
 *       - admin_settings 레이아웃이 구형(fallback/legacy) 잔재 없이 동기화됐는지
 *     → 깨진 테넌트를 "조용히 비어있음"이 아니라 "배포/Job 실패 + ERROR 로그"로 드러낸다.
 *
 * 기존 명령들은 그대로 유지되며, 본 명령은 그것들을 오케스트레이션할 뿐이다.
 *
 * @see deploy/DEPLOY-RECURRING-FAILURES.md RF-18b·RF-19b
 * @see deploy/TENANT-EXPERIENCE-ARCHITECTURE.md
 */
final class SaasTenantReconcileCommand extends Command
{
    protected $signature = 'moabom:saas:tenant-reconcile
        {slug? : 생략·all·* = platform + 모든 active tenant, 또는 slug 1건}
        {--template=moabom-admin_basic : admin 템플릿 identifier}
        {--module=moabom-system : module layout identifier}
        {--skip-template-layouts : template_layouts 동기화 생략}
        {--skip-module-layouts : module_layouts 동기화 생략}
        {--skip-menus : admin 메뉴 동기화 생략}
        {--skip-language-packs : language_packs mirror 생략}
        {--skip-verify : 동기화 후 사용자 표면 검증 생략}';

    protected $description = 'Tenant 런타임 정합성 단일 Reconciler (layouts·menus·language-packs + 검증)';

    public function handle(
        PlatformConnectionFactory $platformConnections,
        PlatformRuntimeConfigurator $platformRuntimeConfigurator,
        TenantDatabaseConfigurator $databaseConfigurator,
        TenantContext $tenantContext,
        LanguagePackService $languagePackService,
    ): int {
        if (! config('moabom-system.saas.enabled', false)) {
            $this->warn('MOABOM_SAAS_ENABLED=false — 건너뜀');

            return self::SUCCESS;
        }

        $slugArg = (string) ($this->argument('slug') ?? '*');
        if ($slugArg === '' || $slugArg === 'all') {
            $slugArg = '*';
        }
        $templateId = (string) $this->option('template');
        $moduleId = (string) $this->option('module');

        $platformConnections->registerConnection();
        $platformRuntimeConfigurator->applyPlatform();

        $stepFailures = [];

        // 단계 인자 — slug 1건이면 해당 slug, 아니면 전체(platform + active tenants).
        $slugArgs = $slugArg === '*' ? [] : ['slug' => $slugArg];

        $this->info(sprintf('=== tenant-reconcile (target=%s, template=%s) ===', $slugArg, $templateId));

        if (! $this->option('skip-template-layouts')) {
            $this->runStep($stepFailures, 'sync-template-layouts', 'moabom:saas:sync-template-layouts', array_merge($slugArgs, [
                '--template' => $templateId,
                '--no-interaction' => true,
            ]));
        }

        if (! $this->option('skip-module-layouts')) {
            $this->runStep($stepFailures, 'sync-module-layouts', 'moabom:saas:sync-module-layouts', array_merge($slugArgs, [
                '--module' => $moduleId,
                '--no-interaction' => true,
            ]));
        }

        if (! $this->option('skip-menus')) {
            $this->runStep($stepFailures, 'module-sync-declarations', 'moabom:module-sync-declarations', [
                'identifier' => $moduleId,
                '--no-interaction' => true,
            ]);
            $this->runStep($stepFailures, 'sync-tenant-admin-menus', 'moabom:saas:sync-tenant-admin-menus', array_merge($slugArgs, [
                '--no-interaction' => true,
            ]));
        }

        if (! $this->option('skip-language-packs')) {
            $this->runStep($stepFailures, 'sync-tenant-language-packs', 'moabom:saas:sync-tenant-language-packs', array_merge($slugArgs, [
                '--no-interaction' => true,
            ]));
        }

        // 캐시는 마지막에 한 번만 비운다 (template-lang·layout 캐시 무효화).
        $this->runStep($stepFailures, 'template:cache-clear', 'template:cache-clear', ['--no-interaction' => true]);

        // ── 검증: 실제 사용자 표면이 정상인지 (두더지잡기 종결의 핵심) ──
        $verifyFailures = [];
        if (! $this->option('skip-verify')) {
            try {
                $verifyFailures = $this->verifyTargets(
                    $slugArg,
                    $templateId,
                    $databaseConfigurator,
                    $tenantContext,
                    $languagePackService,
                );
            } catch (\Throwable $e) {
                $verifyFailures[] = 'verify 단계 예외: '.$e->getMessage();
            } finally {
                $platformRuntimeConfigurator->applyPlatform();
            }
        }

        $this->newLine();
        $this->info('=== SUMMARY ===');
        $this->line(sprintf('steps=%d step_failures=%d verify_failures=%d', $this->stepCount(), count($stepFailures), count($verifyFailures)));
        foreach ($stepFailures as $f) {
            $this->error('  [step] '.$f);
        }
        foreach ($verifyFailures as $f) {
            $this->error('  [verify] '.$f);
        }

        return ($stepFailures === [] && $verifyFailures === []) ? self::SUCCESS : self::FAILURE;
    }

    /**
     * @param  list<string>  $failures
     * @param  array<string, mixed>  $args
     */
    private function runStep(array &$failures, string $label, string $command, array $args): void
    {
        $this->newLine();
        $this->info("--- {$label} ---");
        try {
            $code = Artisan::call($command, $args, $this->output);
            if ($code !== self::SUCCESS) {
                $failures[] = sprintf('%s exit=%d', $label, $code);
            }
        } catch (\Throwable $e) {
            $failures[] = sprintf('%s 예외=%s', $label, $e->getMessage());
            $this->error("  {$label} 예외: ".$e->getMessage());
        }
    }

    private function stepCount(): int
    {
        $count = 1; // template:cache-clear 항상
        $count += $this->option('skip-template-layouts') ? 0 : 1;
        $count += $this->option('skip-module-layouts') ? 0 : 1;
        $count += $this->option('skip-menus') ? 0 : 2;
        $count += $this->option('skip-language-packs') ? 0 : 1;

        return $count;
    }

    /**
     * 동기화 후, platform + 대상 tenant 각각에서 실제 사용자 표면을 검증한다.
     *
     * @return list<string> 실패 메시지 목록 (비어있으면 모두 정상)
     */
    private function verifyTargets(
        string $slugArg,
        string $templateId,
        TenantDatabaseConfigurator $databaseConfigurator,
        TenantContext $tenantContext,
        LanguagePackService $languagePackService,
    ): array {
        $failures = [];

        // platform 검증 (slug 미지정 시)
        if ($slugArg === '*' || $slugArg === '') {
            $failures = array_merge($failures, $this->verifyOne('platform', $templateId, $languagePackService));
        }

        foreach ($this->loadTenants($slugArg) as $tenant) {
            try {
                $databaseConfigurator->apply($tenant);
                $tenantContext->setTenant($tenant, $tenant->host);
            } catch (\Throwable $e) {
                $failures[] = sprintf('%s: DB switch err=%s', $tenant->slug, $e->getMessage());

                continue;
            }

            $failures = array_merge($failures, $this->verifyOne($tenant->slug, $templateId, $languagePackService));
        }

        return $failures;
    }

    /**
     * 단일 컨텍스트(현재 연결된 DB) 검증.
     *
     * @return list<string>
     */
    private function verifyOne(string $label, string $templateId, LanguagePackService $languagePackService): array
    {
        $failures = [];

        // 1) 언어팩 탭이 비어있지 않은지 — 활성 DB / platform VIEW SSOT (Cloud Run 이미지에 미러 없음).
        try {
            $paginator = $languagePackService->list(['exclude_protected' => true], 1);
            $total = (int) $paginator->total();
            if ($total <= 0) {
                $failures[] = sprintf(
                    '%s: 환경설정>언어팩 목록 0건 (RF-19b 재발)',
                    $label,
                );
            } else {
                $this->line(sprintf('  [verify] %s: language-packs total=%d OK', $label, $total));
            }
        } catch (\Throwable $e) {
            $failures[] = sprintf('%s: language-pack list 예외=%s', $label, $e->getMessage());
        }

        // 2) admin_settings 레이아웃이 동기화되어 언어팩 data source 를 포함하는지.
        try {
            $layoutFailure = $this->verifyAdminSettingsLayout($label, $templateId);
            if ($layoutFailure !== null) {
                $failures[] = $layoutFailure;
            } else {
                $this->line(sprintf('  [verify] %s: admin_settings layout OK', $label));
            }
        } catch (\Throwable $e) {
            $failures[] = sprintf('%s: admin_settings 검증 예외=%s', $label, $e->getMessage());
        }

        return $failures;
    }

    private function verifyAdminSettingsLayout(string $label, string $templateId): ?string
    {
        if (! Schema::connection(DB::getDefaultConnection())->hasTable('template_layouts')) {
            return null; // 테이블 없으면 검증 생략 (platform-only 설치 등)
        }

        $template = Template::query()->where('identifier', $templateId)->first();
        if ($template === null) {
            return null; // 템플릿 미설치 — 별도 단계에서 처리
        }

        $layout = TemplateLayout::query()
            ->where('template_id', $template->id)
            ->where('name', 'admin_settings')
            ->first();

        if ($layout === null) {
            return sprintf('%s: admin_settings 레이아웃 DB 미존재 (sync-template-layouts 실패)', $label);
        }

        $serialized = is_string($layout->content)
            ? $layout->content
            : (string) json_encode($layout->content, JSON_UNESCAPED_UNICODE);

        // DB 저장본은 JSON 슬래시 이스케이프(`\/api\/...`)일 수 있으므로 정규화 후 비교한다.
        $normalized = str_replace('\\/', '/', $serialized);

        // 언어팩 탭 data source 가 살아있어야 한다. (엔드포인트는 슬래시 없는 'language-packs' 로도 식별)
        if (! str_contains($normalized, '/api/admin/language-packs')
            && ! str_contains($normalized, 'admin/language-packs')) {
            return sprintf('%s: admin_settings 에 language-packs data source 누락 (구형 레이아웃 잔존)', $label);
        }

        return null;
    }

    /**
     * @return list<TenantRecord>
     */
    private function loadTenants(string $slugArg): array
    {
        if (! Schema::connection('moabom_platform')->hasTable('moabom_saas_tenants')) {
            return [];
        }

        $query = DB::connection('moabom_platform')->table('moabom_saas_tenants');
        if ($slugArg !== '*' && $slugArg !== '') {
            $query->where('slug', $slugArg);
        } else {
            $query->where('status', 'active');
        }

        return $query->orderBy('slug')->get()
            ->map(fn ($row) => TenantRecord::fromRow((array) $row))
            ->all();
    }
}
