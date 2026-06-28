<?php

namespace Modules\Moabom\System\Providers;

use App\Contracts\Extension\CacheInterface;
use App\Contracts\Repositories\ConfigRepositoryInterface;
use App\Contracts\Repositories\MenuRepositoryInterface;
use App\Contracts\Repositories\RoleRepositoryInterface;
use App\Extension\BaseModuleServiceProvider;
use App\Extension\Helpers\ExtensionMenuSyncHelper;
use App\Http\View\Composers\TemplateComposer;
use App\Http\View\Composers\UserTemplateComposer;
use App\Services\ModuleSettingsService;
use App\Services\PluginSettingsService;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\View;
use Modules\Moabom\System\Contracts\ExtensionCatalogBuilderInterface;
use Modules\Moabom\System\Contracts\ShellAppUsageRepositoryInterface;
use Modules\Moabom\System\Contracts\SystemSettingsServiceInterface;
use Modules\Moabom\System\Experience\TenantExperienceDefaultsReader;
use Modules\Moabom\System\Experience\TenantExperienceRevision;
use Modules\Moabom\System\Experience\TenantSettingsWriter;
use Modules\Moabom\System\Console\Commands\MoabomModuleSyncDeclarationsCommand;
use Modules\Moabom\System\Console\Commands\SaasDiffTenantCommand;
use Modules\Moabom\System\Console\Commands\SaasInspectDbCommand;
use Modules\Moabom\System\Console\Commands\SaasMeasureSplitBrainCommand;
use Modules\Moabom\System\Console\Commands\SaasHydratePlatformSettingsCommand;
use Modules\Moabom\System\Console\Commands\SaasNormalizeAdminCredentialsCommand;
use Modules\Moabom\System\Console\Commands\SaasBackfillTenantDisplayCommand;
use Modules\Moabom\System\Console\Commands\SaasCaptureProvisionAppearanceDefaultsCommand;
use Modules\Moabom\System\Console\Commands\SaasSetTenantFontSizeDefaultCommand;
use Modules\Moabom\System\Console\Commands\SaasTenantReapplyAppearanceDefaultsCommand;
use Modules\Moabom\System\Console\Commands\SaasMigrateG7CoreSettingsToDbCommand;
use Modules\Moabom\System\Console\Commands\SaasMigrateModuleSettingsToDbCommand;
use Modules\Moabom\System\Console\Commands\SaasSyncTenantAdminMenusCommand;
use Modules\Moabom\System\Console\Commands\SaasTenantRepairCommand;
use Modules\Moabom\System\Console\Commands\SaasTenantReconcileCommand;
use Modules\Moabom\System\Console\Commands\SaasPlatformMigrateCommand;
use Modules\Moabom\System\Console\Commands\SaasTenantsMigrateCommand;
use Modules\Moabom\System\Console\Commands\SaasPlatformSettingsRestoreCommand;
use Modules\Moabom\System\Console\Commands\SaasTenantAdminTokenCommand;
use Modules\Moabom\System\Console\Commands\SaasPlatformAdminTokenCommand;
use Modules\Moabom\System\Console\Commands\SaasTenantBootstrapIdentityCommand;
use Modules\Moabom\System\Console\Commands\SaasTenantProvisionCommand;
use Modules\Moabom\System\Console\Commands\SaasTenantShowCommand;
use Modules\Moabom\System\Console\Commands\SaasSyncPackageExtensionsCommand;
use Modules\Moabom\System\Console\Commands\SaasSyncModuleLayoutsCommand;
use Modules\Moabom\System\Console\Commands\SaasSyncModuleDeclarationsCommand;
use Modules\Moabom\System\Console\Commands\SaasSyncTemplateLayoutsCommand;
use Modules\Moabom\System\Console\Commands\SaasTenantRegisterCommand;
use Modules\Moabom\System\Console\Commands\SaasTenantReseedSettingsCommand;
use Modules\Moabom\System\Console\Commands\SaasTenantSyncSocialAuthCommand;
use Modules\Moabom\System\Extension\MoabomExtensionMenuSyncHelper;
use Modules\Moabom\System\Http\Middleware\ApplyMoabomUserLocale;
use Modules\Moabom\System\Http\Middleware\MoabomGcsAttachmentDownloadMiddleware;
use Modules\Moabom\System\Http\Middleware\RestrictTenantHostPlatformAdminRoutes;
use Modules\Moabom\System\Http\Middleware\ResolveMoabomTenant;
use Modules\Moabom\System\Http\Middleware\RestrictPlatformApiToPlatformHost;
use App\Repositories\JsonConfigRepository;
use Modules\Moabom\System\Repositories\MoabomJsonConfigRepository;
use Modules\Moabom\System\Repositories\ShellAppUsageRepository;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;
use Modules\Moabom\System\Saas\TenantContext;
use Modules\Moabom\System\Saas\PlatformFilesystemSnapshot;
use Modules\Moabom\System\Saas\PlatformRuntimeConfigurator;
use Modules\Moabom\System\Saas\SaasCoreSettingsHydrator;
use Modules\Moabom\System\Saas\TenantDatabaseConfigurator;
use Modules\Moabom\System\Saas\TenantDatabaseBootstrapper;
use Modules\Moabom\System\Saas\TenantFilesystemConfigurator;
use Modules\Moabom\System\Saas\TenantPackageCatalog;
use Modules\Moabom\System\Saas\TenantPackageDatabaseSeeder;
use Modules\Moabom\System\Saas\TenantModuleCategoryJsonStore;
use Modules\Moabom\System\Saas\MoabomDbConfigRepository;
use Modules\Moabom\System\Saas\TenantModuleStorageScope;
use Modules\Moabom\System\Saas\TenantProvisionArtisanRunner;
use Modules\Moabom\System\Saas\TenantProvisionAppearanceDefaultsApplier;
use Modules\Moabom\System\Saas\TenantSiteLogoBootstrapper;
use Modules\Moabom\System\Saas\TenantSocialAuthSettingsSeeder;
use Modules\Moabom\System\Saas\TenantProvisioner;
use Modules\Moabom\System\Saas\TenantProvisionerInterface;
use Modules\Moabom\System\Saas\TenantRegistry;
use Modules\Moabom\System\Saas\TenantBaselineManifest;
use Modules\Moabom\System\Saas\TenantLanguagePackMirror;
use Modules\Moabom\System\Console\Commands\SaasSyncTenantLanguagePacksCommand;
use Modules\Moabom\System\Console\Commands\SaasSetupSharedLanguagePacksCommand;
use Modules\Moabom\System\Saas\TenantCachePurger;
use Modules\Moabom\System\Saas\TenantScopedCacheDecorator;
use Modules\Moabom\System\Saas\Deprovision\TenantDeprovisionGuard;
use Modules\Moabom\System\Saas\Deprovision\TenantDeprovisioner;
use Modules\Moabom\System\Saas\Deprovision\TenantDeprovisionerInterface;
use Modules\Moabom\System\Saas\Deprovision\TenantOperationLogger;
use Modules\Moabom\System\Saas\Usage\TenantUsageReporter;
use Modules\Moabom\System\Saas\SaasCachedConfigBridge;
use Modules\Moabom\System\Saas\TenantContextSwitcher;
use Modules\Moabom\System\Saas\TenantRuntimeBootstrap;
use Modules\Moabom\System\Saas\Queue\TenantQueueBootstrapper;
use Illuminate\Contracts\Events\Dispatcher as EventDispatcher;
use Illuminate\Queue\Events\JobExceptionOccurred;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Queue\Events\JobProcessed;
use Illuminate\Queue\Events\JobProcessing;
use Illuminate\Queue\Queue;
use Modules\Moabom\System\Http\View\Composers\MoabomTemplateComposer;
use Modules\Moabom\System\Support\MoabomGcsAttachmentRegistrar;
use Modules\Moabom\System\Http\View\Composers\MoabomUserBootDeferredAssetsGhostComposer;
use Modules\Moabom\System\Http\View\Composers\MoabomUserTemplateComposer;
use Modules\Moabom\System\Services\ExtensionCatalogBuilder;
use Modules\Moabom\System\Services\HomeBackgroundService;
use Modules\Moabom\System\Services\MoabomExtensionAssetGroupService;
use Modules\Moabom\System\Services\MoabomModuleSettingsService;
use Modules\Moabom\System\Services\MoabomPluginSettingsService;
use Modules\Moabom\System\Services\MoabomShellRoutesFilter;
use Modules\Moabom\System\Services\Shell\ShellAppUsageIngestService;
use Modules\Moabom\System\Services\Shell\ShellRankingService;
use Modules\Moabom\System\Services\Shell\ShellUsageIngestGuard;
use Modules\Moabom\System\Services\SystemSettingsService;
class SystemServiceProvider extends BaseModuleServiceProvider
{
    /**
     * @var array<int, class-string>
     */
    protected array $commands = [
        MoabomModuleSyncDeclarationsCommand::class,
        SaasPlatformMigrateCommand::class,
        SaasTenantRegisterCommand::class,
        SaasTenantReseedSettingsCommand::class,
        SaasTenantSyncSocialAuthCommand::class,
        SaasTenantProvisionCommand::class,
        SaasTenantShowCommand::class,
        SaasTenantAdminTokenCommand::class,
        SaasPlatformAdminTokenCommand::class,
        SaasTenantBootstrapIdentityCommand::class,
        SaasPlatformSettingsRestoreCommand::class,
        SaasMigrateModuleSettingsToDbCommand::class,
        SaasMigrateG7CoreSettingsToDbCommand::class,
        SaasTenantsMigrateCommand::class,
        SaasTenantRepairCommand::class,
        SaasSyncTenantAdminMenusCommand::class,
        SaasSyncTenantLanguagePacksCommand::class,
        SaasInspectDbCommand::class,
        SaasDiffTenantCommand::class,
        SaasMeasureSplitBrainCommand::class,
        SaasHydratePlatformSettingsCommand::class,
        SaasCaptureProvisionAppearanceDefaultsCommand::class,
        SaasTenantReapplyAppearanceDefaultsCommand::class,
        SaasSetTenantFontSizeDefaultCommand::class,
        SaasBackfillTenantDisplayCommand::class,
        SaasNormalizeAdminCredentialsCommand::class,
        SaasSyncPackageExtensionsCommand::class,
        SaasSyncTemplateLayoutsCommand::class,
        SaasSyncModuleLayoutsCommand::class,
        SaasSyncModuleDeclarationsCommand::class,
        SaasTenantReconcileCommand::class,
        SaasSetupSharedLanguagePacksCommand::class,
    ];

    /**
     * 모듈 식별자
     */
    protected string $moduleIdentifier = 'moabom-system';

    /**
     * @var array<int, class-string>
     */
    protected array $storageServices = [
        HomeBackgroundService::class,
        SystemSettingsService::class,
    ];

    /**
     * 서비스 바인딩을 등록합니다.
     */
    public function register(): void
    {
        parent::register();

        // 모듈 설정 병합. Weather/IP geolocation 키는 moabom-weather 플러그인으로 이관됨.
        $this->mergeConfigFrom(
            __DIR__.'/../../config/moabom-system.php',
            'moabom-system',
        );
        SaasCachedConfigBridge::applyIfNeeded();
        $this->configureCoreRuntimeGuards();

        $this->app->scoped(SystemSettingsServiceInterface::class, SystemSettingsService::class);
        $this->app->bind(ExtensionCatalogBuilderInterface::class, ExtensionCatalogBuilder::class);
        $this->app->bind(ShellAppUsageRepositoryInterface::class, ShellAppUsageRepository::class);
        $this->app->scoped(ShellAppUsageIngestService::class);
        $this->app->scoped(ShellRankingService::class);
        $this->app->scoped(ShellUsageIngestGuard::class);

        // 요청당 1 instance — GCS category read memo + Run 워커 간 singleton 오염 방지
        $this->app->scoped(ConfigRepositoryInterface::class, MoabomJsonConfigRepository::class);
        $this->app->scoped(JsonConfigRepository::class, MoabomJsonConfigRepository::class);

        // Weather 서비스 바인딩은 moabom-weather 플러그인으로 분리되었다(2026-06-02).

        // 코어 `app/` 수정 없이: 부트 설정·Blade 확장 에셋 맵에 DB 활성 기준을 반영한다.
        $this->app->singleton(MoabomExtensionAssetGroupService::class);
        $this->app->singleton(MoabomShellRoutesFilter::class);
        $this->app->bind(ModuleSettingsService::class, MoabomModuleSettingsService::class);
        $this->app->bind(PluginSettingsService::class, MoabomPluginSettingsService::class);
        $this->app->bind(UserTemplateComposer::class, MoabomUserTemplateComposer::class);
        $this->app->bind(TemplateComposer::class, MoabomTemplateComposer::class);

        MoabomGcsAttachmentRegistrar::register($this->app);

        // G7 core 의 ConfigRepositoryInterface (file-based JsonConfigRepository) 를
        // DB-backed (MoabomDbConfigRepository) 로 override — G7 core 0 수정.
        // GCS multi-instance race·flock 불가 우회. defaults/schema/categories 는 fallback 위임.
        // @see deploy/AGENT-FAILURE-ANALYSIS.md §10
        $this->app->scoped(\App\Contracts\Repositories\ConfigRepositoryInterface::class, MoabomDbConfigRepository::class);

        // scoped — singleton 이면 platform 요청 memo·tenant slug 가 tenant Host API 에 새어 나감 (DoD-7·401)
        $this->app->scoped(TenantContext::class);
        $this->app->scoped(TenantModuleStorageScope::class);
        $this->app->scoped(TenantModuleCategoryJsonStore::class);
        $this->app->singleton(PlatformConnectionFactory::class);
        $this->app->singleton(TenantRegistry::class);
        $this->app->singleton(TenantDatabaseConfigurator::class);
        $this->app->singleton(TenantFilesystemConfigurator::class);
        $this->app->singleton(PlatformFilesystemSnapshot::class);
        $this->app->singleton(PlatformRuntimeConfigurator::class);
        // ConfigRepositoryInterface(scoped) 주입 — singleton 이면 Run 워커에서 platform general memo 가 tenant 요청에 새어남
        $this->app->scoped(SaasCoreSettingsHydrator::class);
        $this->app->singleton(TenantRuntimeBootstrap::class);
        // 큐 부트스트래퍼는 좁은 TenantContextSwitcher 계약에만 의존(final 유지 + 테스트 가능).
        $this->app->bind(TenantContextSwitcher::class, TenantRuntimeBootstrap::class);
        // 큐 잡 테넌트 전파/복원 (C1) — 워커 프로세스 동안 스택 유지를 위해 singleton.
        $this->app->singleton(TenantQueueBootstrapper::class);
        $this->app->singleton(TenantPackageCatalog::class);
        $this->app->singleton(TenantPackageDatabaseSeeder::class);
        $this->app->singleton(TenantDatabaseBootstrapper::class);
        $this->app->singleton(TenantIdentityBootstrapper::class);
        $this->app->singleton(TenantLocalStorageEnsurer::class);
        $this->app->singleton(TenantProvisionArtisanRunner::class);
        $this->app->singleton(TenantProvisionAppearanceDefaultsApplier::class);
        $this->app->singleton(TenantSiteLogoBootstrapper::class);
        $this->app->singleton(\Modules\Moabom\System\Branding\MoabomSiteLogoResolver::class);
        $this->app->singleton(\Modules\Moabom\System\Branding\SiteLogoPublicCacheInvalidator::class);
        $this->app->singleton(\Modules\Moabom\System\Branding\TenantExperiencePublicCacheInvalidator::class);
        $this->app->singleton(\Modules\Moabom\System\Saas\TenantAdminMenuPolicy::class);
        $this->app->singleton(\Modules\Moabom\System\Saas\TenantAdminMenuSynchronizer::class);
        $this->app->singleton(\Modules\Moabom\System\Saas\TenantLegalPageReader::class);
        $this->app->singleton(\Modules\Moabom\System\Saas\TenantLegalPagesSynchronizer::class);
        $this->app->singleton(TenantSocialAuthSettingsSeeder::class);
        $this->app->singleton(TenantProvisionerInterface::class, TenantProvisioner::class);
        $this->app->singleton(TenantProvisioner::class);
        $this->app->singleton(TenantBaselineManifest::class);
        $this->app->singleton(TenantUsageReporter::class);
        $this->app->singleton(TenantDeprovisionGuard::class);
        $this->app->singleton(TenantOperationLogger::class);
        $this->app->singleton(TenantCachePurger::class);
        $this->app->singleton(TenantLanguagePackMirror::class);
        $this->app->singleton(TenantDeprovisionerInterface::class, TenantDeprovisioner::class);
        $this->app->singleton(TenantDeprovisioner::class);
        $this->app->singleton(TenantExperienceRevision::class);
        $this->app->scoped(TenantExperienceDefaultsReader::class);
        $this->app->scoped(TenantSettingsWriter::class);

        // HTTP API(provision 등)에서 Artisan::call() 로 moabom:* 커맨드를 호출하므로
        // runningInConsole() 가드 없이 항상 등록한다.
        $this->commands($this->commands);

        // 코어 ExtensionMenuSyncHelper 비수정: parent_slug 해석으로 플랫폼 공통 부모 하위 형제 메뉴 지원
        $this->app->singleton(ExtensionMenuSyncHelper::class, static function ($app): ExtensionMenuSyncHelper {
            return new \Modules\Moabom\System\Extension\MoabomExtensionMenuSyncHelper(
                $app->make(MenuRepositoryInterface::class),
                $app->make(RoleRepositoryInterface::class),
            );
        });

        if (config('moabom-system.saas.enabled', false)) {
            $this->app->extend(CacheInterface::class, static function (CacheInterface $cache, $app): CacheInterface {
                return new TenantScopedCacheDecorator($cache, $app->make(TenantContext::class));
            });
        }
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        parent::boot();

        PlatformFilesystemSnapshot::capture();

        // 코어 UserTemplateComposer 이후에 실행되어 지연 확장 에셋 맵만 축소한다.
        View::composer('app', MoabomUserBootDeferredAssetsGhostComposer::class);

        $this->app->booted(function () {
            $router = $this->app->make(Router::class);

            $router->pushMiddlewareToGroup('api', ApplyMoabomUserLocale::class);

            if (MoabomGcsAttachmentRegistrar::usesGcsAttachmentsDisk()) {
                $router->prependMiddlewareToGroup('api', MoabomGcsAttachmentDownloadMiddleware::class);
            }

            if (config('moabom-system.saas.enabled', false)) {
                $router->prependMiddlewareToGroup('api', RestrictPlatformApiToPlatformHost::class);
                $router->prependMiddlewareToGroup('web', RestrictTenantHostPlatformAdminRoutes::class);
                $router->prependMiddlewareToGroup('web', ResolveMoabomTenant::class);
                $router->prependMiddlewareToGroup('api', ResolveMoabomTenant::class);

                $this->registerTenantQueuePropagation();
            }
        });
    }

    /**
     * 코어 런타임 가드 설정을 모듈에서 주입합니다.
     *
     * 목적:
     * - 코어 SettingsService / EnforceIdentityPolicy 에 Moabom 하드코딩을 두지 않고
     *   config 주입만으로 SaaS 동작을 유지.
     */
    private function configureCoreRuntimeGuards(): void
    {
        $existingConfigClearGuards = (array) config('core.config_clear_guards', []);
        $existingConfigClearGuards[] = [
            'enabled_config' => 'moabom-system.saas.enabled',
            'bound_abstract' => TenantContext::class,
            'context_not_null_method' => 'tenant',
        ];
        config(['core.config_clear_guards' => $existingConfigClearGuards]);

        $identitySkipRequestPatterns = array_values(array_unique(array_merge(
            (array) config('core.identity_policy_middleware.skip_request_patterns', []),
            [
                'api/modules/moabom-system/public/*',
                'api/modules/moabom-social-auth/providers',
            ],
        )));
        config(['core.identity_policy_middleware.skip_request_patterns' => $identitySkipRequestPatterns]);

        $identitySkipRouteNames = array_values(array_unique(array_merge(
            (array) config('core.identity_policy_middleware.skip_route_names', []),
            [
                'api.modules.moabom-system.public.*',
                'api.plugins.moabom-social-auth.providers',
            ],
        )));
        config(['core.identity_policy_middleware.skip_route_names' => $identitySkipRouteNames]);
    }

    /**
     * 큐 잡 테넌트 컨텍스트 전파/복원 등록 (C1 — deploy/PROJECT-ARCHITECTURE-HARDENING.md).
     *
     * SaaS 활성 시에만: 디스패치 시점 tenant slug 를 잡 페이로드에 심고(createPayloadUsing),
     * 워커에서 JobProcessing 시 부트스트랩 + 종료 시 직전 컨텍스트 복원한다.
     * 생성자 의존 없는 글로벌 메커니즘 — 모든 큐 잡이 자동으로 테넌트 안전해진다.
     */
    private function registerTenantQueuePropagation(): void
    {
        $bootstrapper = $this->app->make(TenantQueueBootstrapper::class);

        Queue::createPayloadUsing(static function () use ($bootstrapper): array {
            return $bootstrapper->payload();
        });

        $events = $this->app->make(EventDispatcher::class);
        $events->listen(JobProcessing::class, [TenantQueueBootstrapper::class, 'onJobProcessing']);
        $events->listen(JobProcessed::class, [TenantQueueBootstrapper::class, 'onJobSettled']);
        $events->listen(JobFailed::class, [TenantQueueBootstrapper::class, 'onJobSettled']);
        $events->listen(JobExceptionOccurred::class, [TenantQueueBootstrapper::class, 'onJobSettled']);
    }
}
