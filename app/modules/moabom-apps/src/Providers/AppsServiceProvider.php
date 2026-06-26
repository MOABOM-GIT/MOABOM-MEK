<?php

namespace Modules\Moabom\Apps\Providers;

use App\Extension\BaseModuleServiceProvider;
use App\Extension\HookManager;
use Illuminate\Support\Facades\Route;
use Modules\Moabom\Apps\Apps\AppRegistry;
use Modules\Moabom\Apps\Apps\AppRegistryInterface;
use Modules\Moabom\Apps\Console\Commands\AppsMigrateGeneratedAppsToPlatformCommand;
use Modules\Moabom\Apps\Console\Commands\AppsPlatformMigrateCommand;
use Modules\Moabom\Apps\Console\Commands\AppsPurgeTenantLegacyGeneratedAppsCommand;
use Modules\Moabom\Apps\Console\Commands\AppsRepairLegacyGlobalVisibilityCommand;
use Modules\Moabom\Apps\Console\Commands\MakeAppCommand;
use Modules\Moabom\Apps\Contracts\AiGenerationSessionRepositoryInterface;
use Modules\Moabom\Apps\Contracts\GeneratedAppRepositoryInterface;
use Modules\Moabom\Apps\Http\Controllers\GeneratedAppPreviewController;
use Modules\Moabom\Apps\Models\GeneratedApp;
use Modules\Moabom\Apps\Repositories\AiGenerationSessionRepository;
use Modules\Moabom\Apps\Repositories\GeneratedAppRepository;
use Modules\Moabom\Apps\Services\AiAppService;
use Modules\Moabom\Apps\Services\AiStreamConcurrencyService;
use Modules\Moabom\Apps\Services\GeneratedAppHostingService;
use Modules\Moabom\Apps\Services\WebsiteLinkIconStorageService;
use Modules\Moabom\Apps\Support\GeneratedAppHostParser;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;
use Modules\Moabom\Apps\Support\GeneratedAppPreviewRouting;
use Modules\Moabom\Apps\Support\ShellRankingGeneratedAppScope;

class AppsServiceProvider extends BaseModuleServiceProvider
{
    protected string $moduleIdentifier = 'moabom-apps';

    /**
     * @var array<class-string, class-string>
     */
    protected array $repositories = [
        GeneratedAppRepositoryInterface::class => GeneratedAppRepository::class,
        AiGenerationSessionRepositoryInterface::class => AiGenerationSessionRepository::class,
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

        HookManager::addFilter(
            'moabom.shell_boot.apps',
            function ($apps, $template = 'moabom-basic') {
                $apps = is_array($apps) ? $apps : [];

                return array_merge(
                    $apps,
                    app(AppRegistryInterface::class)->forShell((string) $template),
                );
            },
        );

        HookManager::addFilter(
            'moabom.user_settings.response_data',
            function (array $data, $user): array {
                if (! is_object($user) || ! isset($user->id)) {
                    return $data;
                }

                $data['generated_app_library'] = app(AiAppService::class)
                    ->libraryForUser((int) $user->id);

                return $data;
            },
            10,
            2,
        );

        Route::bind('hostedApp', static function (string $value): GeneratedApp {
            $app = GeneratedAppsConnection::apps()->whereKey((int) $value)->first()
                ?? GeneratedApp::query()->whereKey((int) $value)->first();
            if ($app === null) {
                abort(404);
            }

            return $app;
        });

        $this->registerPreviewDomainRoutes();
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
}
