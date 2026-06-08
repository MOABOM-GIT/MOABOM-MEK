<?php

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Experience\TenantExperienceDefaultsReader;
use Modules\Moabom\System\Saas\TenantFilesystemConfigurator;
use Modules\Moabom\System\Saas\TenantHostParser;
use Modules\Moabom\System\Saas\TenantRegistry;
use Modules\Moabom\System\Saas\TenantRuntimeBootstrap;
use Modules\Moabom\System\Support\MoabomPublicApiCacheKeys;

class SaasTenantShowCommand extends Command
{
    protected $signature = 'moabom:saas:tenant-show {slug : 테넌트 slug} {--host= : HTTP Host (기본: {slug}.mek360.com)}';

    protected $description = '레지스트리·GCS general.json·HTTP 부트 siteMeta 스냅샷 (provision 디버그)';

    public function handle(
        TenantRegistry $registry,
        TenantFilesystemConfigurator $filesystemConfigurator,
        TenantRuntimeBootstrap $runtimeBootstrap,
        TenantExperienceDefaultsReader $defaultsReader,
    ): int {
        $slug = strtolower((string) $this->argument('slug'));
        $host = (string) ($this->option('host') ?: $slug.'.'.config('moabom-system.saas.base_domain', 'mek360.com'));
        $tenant = $registry->findBySlug($slug);

        if ($tenant === null) {
            $this->error("레지스트리에 없음: {$slug}");

            return self::FAILURE;
        }

        $this->info("slug={$tenant->slug} host={$tenant->host} db={$tenant->dbDatabase}");
        $this->line("gcs_prefix={$tenant->gcsPrefix} status={$tenant->status}");
        $this->line("probe_host={$host} registry_by_host=".($registry->findByHost($host)?->slug ?? 'null'));

        $filesystemConfigurator->apply($tenant);
        $generalPath = 'general.json';
        if (Storage::disk('settings')->exists($generalPath)) {
            $raw = Storage::disk('settings')->get($generalPath);
            $this->line('settings/general.json (GCS direct):');
            $this->line($raw ?: '(empty)');
        } else {
            $this->warn('settings/general.json 없음 (tenant prefix 적용 후)');
        }

        $parser = new TenantHostParser(
            (string) config('moabom-system.saas.base_domain', 'mek360.com'),
            (array) config('moabom-system.saas.platform_hosts', []),
        );
        $parsed = $parser->parse($host);
        $request = Request::create('https://'.$host.'/api/modules/moabom-system/public/shell-boot', 'GET', server: ['HTTP_HOST' => $host]);
        $runtimeBootstrap->bootstrapTenant($request, $parsed, $tenant);

        $site = $defaultsReader->siteMeta();
        $this->line('siteMeta (HTTP bootstrap path): '.json_encode($site, JSON_UNESCAPED_UNICODE));
        $this->line('tenantScopeToken='.MoabomPublicApiCacheKeys::tenantScopeToken());

        return self::SUCCESS;
    }
}
