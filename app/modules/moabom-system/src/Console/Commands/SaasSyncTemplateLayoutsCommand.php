<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use App\Contracts\Extension\TemplateManagerInterface;
use App\Models\Template;
use App\Models\TemplateLayout;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;
use Modules\Moabom\System\Saas\PlatformRuntimeConfigurator;
use Modules\Moabom\System\Saas\TenantDatabaseConfigurator;
use Modules\Moabom\System\Saas\TenantRecord;

/**
 * filesystem layouts/*.json (+ partial) → DB template_layouts 동기화.
 *
 * Docker 이미지에 JSON 만 갱신해도 런타임은 DB cached layout 을 쓰므로
 * template:refresh-layout 과 동일하게 platform·tenant DB 모두 갱신한다.
 */
final class SaasSyncTemplateLayoutsCommand extends Command
{
    /** admin_settings 정보 탭 — memory_usage 객체 직접 렌더(React #31) 잔존 패턴 */
    private const LEGACY_MEMORY_SPAN_PATTERN = '/systemInfo\?\.data\?\.memory_usage\s*\?\?/';

    protected $signature = 'moabom:saas:sync-template-layouts
        {slug? : 생략·all·* = platform + active tenants, 또는 tenant slug 1건}
        {--template=moabom-admin_basic : 갱신할 admin 템플릿 identifier}
        {--skip-platform : platform DB 갱신 생략}';

    protected $description = 'filesystem 템플릿 레이아웃 → DB 동기화 (platform + SaaS tenant)';

    public function handle(
        PlatformConnectionFactory $platformConnections,
        PlatformRuntimeConfigurator $platformRuntimeConfigurator,
        TenantDatabaseConfigurator $databaseConfigurator,
        TemplateManagerInterface $templateManager,
    ): int {
        $slugArg = (string) ($this->argument('slug') ?? '*');
        if ($slugArg === '' || $slugArg === 'all') {
            $slugArg = '*';
        }
        $templateId = (string) $this->option('template');
        $skipPlatform = (bool) $this->option('skip-platform');

        $platformConnections->registerConnection();
        $platformRuntimeConfigurator->applyPlatform();

        $templateManager->loadTemplates();

        $failures = 0;

        if (! $skipPlatform && ($slugArg === '*' || $slugArg === '')) {
            $this->info("=== platform (layout sync: {$templateId}) ===");
            if (! $this->refreshTemplate($templateManager, $templateId, 'platform')) {
                $failures++;
            }
            $this->newLine();
        }

        if ($slugArg === '*' || $slugArg === '') {
            $tenants = $this->loadActiveTenants();
        } elseif ($skipPlatform || $slugArg !== 'platform') {
            $tenants = $this->loadTenants($slugArg);
        } else {
            $tenants = [];
        }

        foreach ($tenants as $tenant) {
            $this->info(sprintf('=== %s (host=%s db=%s) ===', $tenant->slug, $tenant->host, $tenant->dbDatabase));

            try {
                $databaseConfigurator->apply($tenant);
            } catch (\Throwable $e) {
                $this->error('  DB switch err: '.$e->getMessage());
                $failures++;

                continue;
            }

            if (! $this->refreshTemplate($templateManager, $templateId, $tenant->slug)) {
                $failures++;
            }

            $this->newLine();
        }

        $platformRuntimeConfigurator->applyPlatform();

        Artisan::call('template:cache-clear', [], $this->output);

        if ($failures > 0) {
            $this->warn("⚠️  {$failures}개 DB layout sync 실패");

            return self::FAILURE;
        }

        $this->info('✅ template layout sync 완료');

        return self::SUCCESS;
    }

    private function refreshTemplate(TemplateManagerInterface $templateManager, string $templateId, string $label): bool
    {
        try {
            $result = $templateManager->refreshTemplateLayouts($templateId);
            if (! ($result['success'] ?? false)) {
                $this->error("  [{$label}] refresh 실패");

                return false;
            }

            $this->line(sprintf(
                '  [layouts] %s: created=%d updated=%d deleted=%d unchanged=%d skipped=%d',
                $label,
                (int) ($result['created'] ?? 0),
                (int) ($result['updated'] ?? 0),
                (int) ($result['deleted'] ?? 0),
                (int) ($result['unchanged'] ?? 0),
                (int) ($result['skipped'] ?? 0),
            ));

            if (! $this->assertAdminSettingsMemoryBinding($templateId, $label)) {
                return false;
            }

            return true;
        } catch (\Throwable $e) {
            $this->error("  [{$label}] {$e->getMessage()}");

            return false;
        }
    }

    private function assertAdminSettingsMemoryBinding(string $templateId, string $label): bool
    {
        $template = Template::query()->where('identifier', $templateId)->first();
        if ($template === null) {
            $this->warn("  [{$label}] template '{$templateId}' 없음 — memory 바인딩 검증 생략");

            return true;
        }

        $layout = TemplateLayout::query()
            ->where('template_id', $template->id)
            ->where('name', 'admin_settings')
            ->first();

        if ($layout === null) {
            $this->warn("  [{$label}] admin_settings 레이아웃 없음 — 검증 생략");

            return true;
        }

        $serialized = is_string($layout->content)
            ? $layout->content
            : json_encode($layout->content, JSON_UNESCAPED_UNICODE);

        if ($serialized !== false && preg_match(self::LEGACY_MEMORY_SPAN_PATTERN, $serialized) === 1) {
            $this->error("  [{$label}] admin_settings 에 구형 memory_usage 객체 바인딩 잔존 (React #31)");

            return false;
        }

        if ($serialized !== false && ! str_contains($serialized, 'memory_usage?.used')) {
            $this->warn("  [{$label}] admin_settings 에 memory_usage?.used 바인딩 없음 — 수동 확인");

            return true;
        }

        $this->line("  [{$label}] admin_settings memory 바인딩 OK");

        return true;
    }

    /**
     * @return list<TenantRecord>
     */
    private function loadActiveTenants(): array
    {
        return $this->loadTenants('*');
    }

    /**
     * @return list<TenantRecord>
     */
    private function loadTenants(string $slugArg): array
    {
        if (! Schema::connection('moabom_platform')->hasTable('moabom_saas_tenants')) {
            return [];
        }

        $query = \Illuminate\Support\Facades\DB::connection('moabom_platform')->table('moabom_saas_tenants');
        if ($slugArg !== '*' && $slugArg !== '') {
            $query->where('slug', $slugArg);
        } else {
            $query->where('status', 'active');
        }

        $rows = $query->orderBy('slug')->get();

        return $rows->map(fn ($row) => TenantRecord::fromRow((array) $row))->all();
    }
}
