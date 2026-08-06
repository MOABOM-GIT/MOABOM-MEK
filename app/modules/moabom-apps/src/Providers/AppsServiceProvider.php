<?php

namespace Modules\Moabom\Apps\Providers;

use App\Extension\BaseModuleServiceProvider;
use App\Extension\HookManager;
use App\Extension\ModuleManager;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Route;
use Modules\Moabom\Apps\Apps\AppRegistry;
use Modules\Moabom\Apps\Apps\AppRegistryInterface;
use Modules\Moabom\Apps\Console\Commands\AppsMigrateGeneratedAppsToPlatformCommand;
use Modules\Moabom\Apps\Console\Commands\AppsPlatformMigrateCommand;
use Modules\Moabom\Apps\Console\Commands\AppsPurgeTenantLegacyGeneratedAppsCommand;
use Modules\Moabom\Apps\Console\Commands\AppsRepairLegacyGlobalVisibilityCommand;
use Modules\Moabom\Apps\Console\Commands\MakeAppCommand;
use Modules\Moabom\Apps\Contracts\AiGenerationSessionRepositoryInterface;
use Modules\Moabom\Apps\Contracts\AppCommunityPostRepositoryInterface;
use Modules\Moabom\Apps\Contracts\GeneratedAppRepositoryInterface;
use Modules\Moabom\Apps\Http\Controllers\GeneratedAppPreviewController;
use Modules\Moabom\Apps\Http\Middleware\RestrictToGeneratedAppHostedHost;
use Modules\Moabom\Apps\Listeners\AppSeoCacheListener;
use Modules\Moabom\Apps\Models\GeneratedApp;
use Modules\Moabom\Apps\Seo\AppSeoHookRegistrar;
use Modules\Moabom\Apps\Seo\AppsSitemapContributor;
use Modules\Moabom\Apps\Repositories\AiGenerationSessionRepository;
use Modules\Moabom\Apps\Repositories\AppCommunityPostRepository;
use Modules\Moabom\Apps\Repositories\GeneratedAppRepository;
use Modules\Moabom\Apps\Services\AiAppService;
use Modules\Moabom\Apps\Services\AiStreamConcurrencyService;
use Modules\Moabom\Apps\Services\CreateAppCreditGate;
use Modules\Moabom\Apps\Services\AppCommunityNotificationDataService;
use Modules\Moabom\Apps\Services\GeneratedAppHostingService;
use Modules\Moabom\Apps\Services\WebsiteLinkIconStorageService;
use Modules\Moabom\Apps\Support\GeneratedAppHostParser;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;
use Modules\Moabom\Apps\Support\GeneratedAppPreviewRouting;
use Modules\Moabom\Apps\Support\ShellRankingGeneratedAppScope;
use Modules\Moabom\System\Support\MoabomPublicApiCache;
use Modules\Moabom\System\Support\MoabomPublicApiCacheKeys;

class AppsServiceProvider extends BaseModuleServiceProvider
{
    protected string $moduleIdentifier = 'moabom-apps';

    /**
     * @var array<class-string, class-string>
     */
    protected array $repositories = [
        GeneratedAppRepositoryInterface::class => GeneratedAppRepository::class,
        AiGenerationSessionRepositoryInterface::class => AiGenerationSessionRepository::class,
        AppCommunityPostRepositoryInterface::class => AppCommunityPostRepository::class,
    ];

    /**
     * @var array<int, class-string>
     */
    protected array $storageServices = [
        GeneratedAppHostingService::class,
        WebsiteLinkIconStorageService::class,
    ];

    public function register(): void
    {
        parent::register();

        $this->mergeConfigFrom(
            dirname(__DIR__, 2).'/config/moabom-apps.php',
            'moabom-apps',
        );

        GeneratedAppsConnection::register();

        $this->app->singleton(AppRegistryInterface::class, AppRegistry::class);
        $this->app->singleton(AiStreamConcurrencyService::class);
        $this->app->singleton(CreateAppCreditGate::class);

        $this->commands([
            MakeAppCommand::class,
            AppsPlatformMigrateCommand::class,
            AppsMigrateGeneratedAppsToPlatformCommand::class,
            AppsPurgeTenantLegacyGeneratedAppsCommand::class,
            AppsRepairLegacyGlobalVisibilityCommand::class,
        ]);
    }

    public function boot(): void
    {
        parent::boot();

        $this->registerGeneratedAppHostHooks();
        $this->registerShellRankingScopeHooks();
        $this->registerAppCommunityNotificationHooks();
        $this->registerAppSeo();
        $this->registerSmartChatDataResources();

        HookManager::addFilter(
            'moabom.shell_boot.apps',
            function ($apps, $template = 'moabom-basic') {
                $apps = is_array($apps) ? $apps : [];
                $template = (string) $template;
                /** @var list<array<string, mixed>> $registryApps */
                $registryApps = MoabomPublicApiCache::remember(
                    MoabomPublicApiCacheKeys::shellAppsRegistry($template),
                    fn (): array => app(AppRegistryInterface::class)->forShell($template),
                );

                return array_merge($apps, $registryApps);
            },
        );

        HookManager::addFilter(
            'moabom.user_settings.response_data',
            function (array $data, $user, string $scope = 'full'): array {
                // critical shell-state는 설정 first paint 전용. 라이브러리는 전용 단일 API가 소유한다.
                if ($scope === 'critical' || ! is_object($user) || ! isset($user->id)) {
                    return $data;
                }

                $data['generated_app_library'] = app(AiAppService::class)
                    ->libraryForUser((int) $user->id);

                return $data;
            },
            10,
            3,
        );

        Route::bind('hostedApp', static function (string $value): GeneratedApp {
            $app = GeneratedAppsConnection::apps()->whereKey((int) $value)->first();
            if ($app === null) {
                abort(404);
            }

            return $app;
        });

        $this->registerPreviewDomainRoutes();
        $this->registerHostedDataApiRoutes();
    }

    /**
     * 앱 SEO/AI 노출 — core.seo.* 훅, sitemap 기여자, 공개 마이앱 캐시 무효화 리스너.
     */
    private function registerAppSeo(): void
    {
        if (! (bool) config('moabom-apps.seo.enabled', true)) {
            return;
        }

        app(AppSeoHookRegistrar::class)->register();
        app(AppSeoCacheListener::class)->register();

        $this->app->booted(function (): void {
            if ($this->app->bound(\App\Seo\SitemapGenerator::class)) {
                $this->app->make(\App\Seo\SitemapGenerator::class)
                    ->registerContributor($this->app->make(AppsSitemapContributor::class));
            }
        });
    }

    private function registerShellRankingScopeHooks(): void
    {
        $filterScores = function (array $scores): array {
            return app(ShellRankingGeneratedAppScope::class)->filterAppScoreRows($scores);
        };

        $allowIngest = function (bool $allowed, string $appId): bool {
            if (! $allowed) {
                return false;
            }

            return app(ShellRankingGeneratedAppScope::class)->allowsShellAppId($appId);
        };

        HookManager::addFilter('moabom.shell_rankings.filter_app_scores', $filterScores, 10, 1);
        HookManager::addFilter('moabom.shell_rankings.allow_app_usage_ingest', $allowIngest, 10, 2);
    }

    private function registerAppCommunityNotificationHooks(): void
    {
        HookManager::addFilter(
            'moabom-apps.notification.extract_data',
            static fn (array $default, string $type, array $args): array => app(AppCommunityNotificationDataService::class)
                ->extractData($default, $type, $args),
            20,
            3,
        );

        HookManager::addFilter(
            'core.notification.filter_default_definitions',
            function (array $definitions): array {
                /** @var \Modules\Moabom\Apps\Module|null $module */
                $module = app(ModuleManager::class)->getModule($this->moduleIdentifier);
                if ($module === null) {
                    return $definitions;
                }

                foreach ($module->getNotificationDefinitions() as $definition) {
                    $definitions[] = array_merge($definition, [
                        'extension_type' => 'module',
                        'extension_identifier' => $module->getIdentifier(),
                    ]);
                }

                return $definitions;
            },
            20,
            1,
        );
    }

    /**
     * 스마트챗 범용 데이터 카탈로그(`moabom.smart_chat.data_resources`)에
     * 앱 도메인 리소스를 등록한다 — 스키마 소유권은 이 모듈에 있다.
     * columns 는 노출 allowlist, query 는 권한 스코프가 강제된 base Builder 를 반환해야 한다.
     */
    private function registerSmartChatDataResources(): void
    {
        HookManager::addFilter(
            'moabom.smart_chat.data_resources',
            static function ($resources): array {
                $resources = is_array($resources) ? $resources : [];

                // 데이터 plane SSOT: SaaS 활성 시 생성앱은 platform DB(moabom_platform).
                // GeneratedApp::query() 직접 호출은 빈 테넌트 잔재 테이블을 읽는다 —
                // 반드시 GeneratedAppsConnection 접근자를 사용한다.
                $resources[] = [
                    'name' => 'apps',
                    'description' => 'Public AI-generated apps with community rating/review counters.',
                    'columns' => [
                        'id', 'title', 'app_type',
                        'community_rating_avg', 'community_rating_count', 'community_post_count',
                        'created_at',
                    ],
                    'query' => static function ($user) {
                        unset($user);
                        $q = GeneratedAppsConnection::apps();
                        \Modules\Moabom\Apps\Support\GeneratedAppPublishPolicy::applyPublishedCatalogScope($q);

                        return $q->getQuery();
                    },
                ];

                $resources[] = [
                    'name' => 'my_apps',
                    'description' => "The current user's own generated apps (any visibility).",
                    'columns' => [
                        'id', 'title', 'app_type', 'visibility', 'version',
                        'community_rating_avg', 'community_rating_count', 'community_post_count',
                        'created_at', 'updated_at',
                    ],
                    'query' => static function ($user) {
                        $query = GeneratedAppsConnection::apps()
                            ->where('user_id', (int) $user->id);

                        return GeneratedAppsConnection::scopeToCurrentTenant($query)->getQuery();
                    },
                ];

                $resources[] = [
                    'name' => 'app_reviews',
                    'description' => 'Published community reviews/talk on public apps (post_type: review|talk, rating 1-5).',
                    'columns' => [
                        'id', 'generated_app_id', 'post_type', 'rating', 'title',
                        'comments_count', 'created_at',
                    ],
                    'query' => static function ($user) {
                        unset($user);
                        $apps = GeneratedAppsConnection::apps()->select('id');
                        \Modules\Moabom\Apps\Support\GeneratedAppPublishPolicy::applyPublishedCatalogScope($apps);

                        return GeneratedAppsConnection::communityPosts()
                            ->where('status', 'published')
                            ->whereIn('generated_app_id', $apps->getQuery())
                            ->getQuery()
                            ->whereNull('deleted_at');
                    },
                ];

                return $resources;
            },
        );
    }

    private function registerGeneratedAppHostHooks(): void
    {
        HookManager::addFilter(
            'moabom.saas.override_host_parse',
            function ($parsed, string $host) {
                if (GeneratedAppPreviewRouting::usesTenantPath() || ! is_array($parsed)) {
                    return $parsed;
                }

                $previewHost = app(GeneratedAppHostParser::class)->parse($host);
                if ($previewHost['type'] === 'standard') {
                    return [
                        'type' => 'platform',
                        'slug' => null,
                        'host' => $previewHost['host'],
                    ];
                }

                if (($parsed['type'] ?? '') === 'tenant' && $previewHost['type'] === 'standard') {
                    return [
                        'type' => 'platform',
                        'slug' => null,
                        'host' => $previewHost['host'],
                    ];
                }

                return $parsed;
            },
            10,
            2,
        );

        HookManager::addFilter(
            'moabom.saas.resolve_unknown_host',
            function ($resolved, string $host) {
                if (GeneratedAppPreviewRouting::usesTenantPath()) {
                    return $resolved;
                }

                $parsed = app(GeneratedAppHostParser::class)->parse($host);
                if ($parsed['type'] === 'standard') {
                    return [
                        'type' => 'platform',
                        'host' => $parsed['host'],
                        'attributes' => [],
                    ];
                }

                if ($parsed['type'] !== 'hosted' || $parsed['app_id'] === null) {
                    return $resolved;
                }

                return [
                    'type' => 'platform',
                    'host' => $parsed['host'],
                    'attributes' => [
                        'moabom_generated_app_id' => $parsed['app_id'],
                    ],
                ];
            },
            10,
            3,
        );
    }

    private function registerPreviewDomainRoutes(): void
    {
        if (GeneratedAppPreviewRouting::usesTenantPath()) {
            return;
        }

        $standardHost = GeneratedAppPreviewRouting::standardHost();
        if ($standardHost !== '') {
            Route::domain($standardHost)
                ->middleware('web')
                ->group(function (): void {
                    Route::get('g/{id}', [GeneratedAppPreviewController::class, 'standard'])
                        ->whereNumber('id')
                        ->name('moabom-apps.preview.standard.domain');
                });
        }

        $hostedAppsDomain = GeneratedAppPreviewRouting::hostedAppsDomain();
        if ($hostedAppsDomain !== '') {
            Route::domain('{appId}.'.$hostedAppsDomain)
                ->middleware('web')
                ->whereNumber('appId')
                ->group(function (): void {
                    Route::get('/', [GeneratedAppPreviewController::class, 'hostedRoot'])
                        ->name('moabom-apps.preview.hosted.domain');
                });
        }
    }

    /**
     * Hosted row API — preview_token 으로 인증하므로 CSRF 면제.
     *
     * dedicated_host: /api/data/* (RestrictToGeneratedAppHostedHost)
     * 폴백: /modules/moabom-apps/preview/hosted/{id}/api/data/*
     */
    private function registerHostedDataApiRoutes(): void
    {
        $csrfExempt = [VerifyCsrfToken::class];

        Route::middleware(['web'])
            ->withoutMiddleware($csrfExempt)
            ->prefix(GeneratedAppPreviewRouting::pathPrefix().'/hosted/{hostedApp}')
            ->whereNumber('hostedApp')
            ->group(function (): void {
                Route::get('api/data/{tableKey}', [GeneratedAppPreviewController::class, 'listHostedData'])
                    ->where('tableKey', '[A-Za-z0-9_-]+');
                Route::post('api/data/{tableKey}', [GeneratedAppPreviewController::class, 'storeHostedData'])
                    ->where('tableKey', '[A-Za-z0-9_-]+');
                Route::put('api/data/{tableKey}/{rowId}', [GeneratedAppPreviewController::class, 'updateHostedData'])
                    ->whereNumber('rowId')
                    ->where('tableKey', '[A-Za-z0-9_-]+');
                Route::delete('api/data/{tableKey}/{rowId}', [GeneratedAppPreviewController::class, 'destroyHostedData'])
                    ->whereNumber('rowId')
                    ->where('tableKey', '[A-Za-z0-9_-]+');
            });

        if (GeneratedAppPreviewRouting::usesTenantPath()) {
            return;
        }

        Route::middleware(['web', RestrictToGeneratedAppHostedHost::class])
            ->withoutMiddleware($csrfExempt)
            ->group(function (): void {
                Route::get('api/data/{tableKey}', [GeneratedAppPreviewController::class, 'listHostedDataByHost'])
                    ->where('tableKey', '[A-Za-z0-9_-]+');
                Route::post('api/data/{tableKey}', [GeneratedAppPreviewController::class, 'storeHostedDataByHost'])
                    ->where('tableKey', '[A-Za-z0-9_-]+');
                Route::put('api/data/{tableKey}/{rowId}', [GeneratedAppPreviewController::class, 'updateHostedDataByHost'])
                    ->whereNumber('rowId')
                    ->where('tableKey', '[A-Za-z0-9_-]+');
                Route::delete('api/data/{tableKey}/{rowId}', [GeneratedAppPreviewController::class, 'destroyHostedDataByHost'])
                    ->whereNumber('rowId')
                    ->where('tableKey', '[A-Za-z0-9_-]+');
            });
    }
}
