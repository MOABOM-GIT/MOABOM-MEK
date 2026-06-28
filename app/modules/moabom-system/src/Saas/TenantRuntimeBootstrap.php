<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use App\Contracts\Repositories\ConfigRepositoryInterface;
use App\Extension\HookManager;
use Illuminate\Http\Request;
use Modules\Moabom\System\Repositories\MoabomJsonConfigRepository;
use Symfony\Component\HttpFoundation\Response;

/**
 * SaaS 요청 런타임 단일 부트스트랩.
 *
 * Host → DB + GCS prefix + G7 config() 동기화를 한 곳에서 수행한다.
 * (G7 단일 사이트는 SettingsServiceProvider::boot() 1회로 충분 — SaaS는 Host마다 prefix 가 달라
 *  middleware 직후 이 클래스가 G7 부트스트랩을 재현한다.)
 *
 * TenantContext·SaasCoreSettingsHydrator 는 scoped — singleton 생성자 주입 시
 * forgetScopedInstances() 후 컨테이너 인스턴스와 분리되어 DoD-7·401 이 발생한다.
 */
final class TenantRuntimeBootstrap implements TenantContextSwitcher
{
    public function __construct(
        private readonly TenantRegistry $tenantRegistry,
        private readonly TenantDatabaseConfigurator $databaseConfigurator,
        private readonly TenantFilesystemConfigurator $filesystemConfigurator,
        private readonly PlatformRuntimeConfigurator $platformRuntimeConfigurator,
    ) {}

    /**
     * @param  array{type: string, host: string}  $parsed  TenantHostParser::parse 결과
     */
    public function bootstrapPlatform(Request $request, array $parsed): void
    {
        $this->resetSettingsRepositoryMemo();
        $this->tenantContext()->setPlatform($parsed['host']);
        $this->platformRuntimeConfigurator->applyPlatform();
        $this->applyAppUrl($request->getScheme().'://'.$parsed['host']);
        $this->settingsHydrator()->hydrate();
    }

    /**
     * @param  array{type: string, host: string}  $parsed
     */
    public function bootstrapTenant(Request $request, array $parsed, TenantRecord $tenant): void
    {
        $this->resetSettingsRepositoryMemo();
        $this->tenantContext()->setTenant($tenant, $parsed['host']);
        $this->databaseConfigurator->apply($tenant);

        $appUrl = $tenant->appUrl ?: $request->getScheme().'://'.$parsed['host'];
        $this->applyAppUrl($appUrl);
        $this->settingsHydrator()->hydrate();
        // hydrate() 내 storage_driver 적용이 GCS path_prefix 를 플랫폼(attachments/)로 리셋하므로
        // 테넌트 prefix(tenants/{slug}/attachments) 는 hydrate 이후에 다시 적용한다.
        $this->filesystemConfigurator->apply($tenant);

        HookManager::doAction('moabom.saas.tenant_resolved', $tenant, $parsed['host']);
    }

    public function resolveTenant(string $host): ?TenantRecord
    {
        $tenant = $this->tenantRegistry->findByHost($host);
        if ($tenant !== null) {
            return $tenant;
        }

        if (! app()->environment('local')) {
            return null;
        }

        $devSlug = (string) config('moabom-system.saas.dev_tenant_slug', '');
        if ($devSlug === '') {
            return null;
        }

        return $this->tenantRegistry->findBySlug($devSlug);
    }

    /** settings 저장 직후 — config:clear 후 DB·GCS prefix·G7 config 재동기화 */
    public function rehydrateAfterSettingsSave(TenantContext $context): void
    {
        SaasCachedConfigBridge::applyIfNeeded();

        if ($context->isPlatformRequest()) {
            $this->platformRuntimeConfigurator->applyPlatform();
        } else {
            $tenant = $context->tenant();
            if ($tenant !== null) {
                $this->databaseConfigurator->apply($tenant);
            }
        }

        $this->settingsHydrator()->hydrate();

        if (! $context->isPlatformRequest()) {
            $tenant = $context->tenant();
            if ($tenant !== null) {
                $this->filesystemConfigurator->apply($tenant);
            }
        }
    }

    /**
     * HTTP 요청 밖(큐 잡·스케줄러·콘솔)에서 slug 로 테넌트 런타임을 부트스트랩한다.
     *
     * ResolveMoabomTenant 미들웨어가 없는 워커 프로세스에서 cross-tenant 데이터
     * 유출을 막기 위한 요청-비의존 경로. 미들웨어 경로(bootstrapTenant)와 동일한
     * DB·GCS·G7 config 동기화를 수행하되 Request 대신 tenant->host 를 사용한다.
     *
     * @return bool 레지스트리에서 tenant 를 찾아 부트스트랩했으면 true
     */
    public function bootstrapTenantBySlug(string $slug): bool
    {
        $tenant = $this->tenantRegistry->findBySlug($slug);
        if ($tenant === null) {
            return false;
        }

        $this->resetSettingsRepositoryMemo();
        $this->tenantContext()->setTenant($tenant, $tenant->host);
        $this->databaseConfigurator->apply($tenant);
        $this->applyAppUrl($tenant->appUrl ?: 'https://'.$tenant->host);
        $this->settingsHydrator()->hydrate();
        $this->filesystemConfigurator->apply($tenant);

        HookManager::doAction('moabom.saas.tenant_resolved', $tenant, $tenant->host);

        return true;
    }

    /**
     * HTTP 요청 밖에서 플랫폼(기본 DB·GCS prefix 없음) 컨텍스트로 복원한다.
     * 큐 잡 처리 완료 후 워커를 platform 기준으로 되돌려 다음 잡 오염을 막는다.
     */
    public function restorePlatformContext(): void
    {
        $this->resetSettingsRepositoryMemo();
        $hosts = (array) config('moabom-system.saas.platform_hosts', []);
        $host = (string) ($hosts[0] ?? '');
        $this->tenantContext()->setPlatform($host);
        $this->platformRuntimeConfigurator->applyPlatform();
        $this->settingsHydrator()->hydrate();
    }

    public function tenantNotFoundResponse(string $host): Response
    {
        if (request()->expectsJson() || request()->is('api/*')) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant not found or inactive.',
                'host' => $host,
            ], 404);
        }

        return response(
            '업체 사이트를 찾을 수 없습니다. 주소를 확인해 주세요.',
            404
        );
    }

    private function tenantContext(): TenantContext
    {
        return app(TenantContext::class);
    }

    private function settingsHydrator(): SaasCoreSettingsHydrator
    {
        return app(SaasCoreSettingsHydrator::class);
    }

    private function applyAppUrl(string $url): void
    {
        config([
            'app.url' => rtrim($url, '/'),
            'filesystems.disks.public.url' => rtrim($url, '/').'/storage',
        ]);
    }

    private function resetSettingsRepositoryMemo(): void
    {
        $repo = app(ConfigRepositoryInterface::class);
        if ($repo instanceof MoabomJsonConfigRepository) {
            $repo->resetRequestState();
        }
    }
}
