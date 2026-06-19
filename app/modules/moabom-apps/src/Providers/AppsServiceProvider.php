<?php

namespace Modules\Moabom\Apps\Providers;

use App\Extension\BaseModuleServiceProvider;
use App\Extension\HookManager;
use Modules\Moabom\Apps\Apps\AppRegistry;
use Modules\Moabom\Apps\Apps\AppRegistryInterface;
use Modules\Moabom\Apps\Console\Commands\MakeAppCommand;
use Modules\Moabom\Apps\Contracts\AiGenerationSessionRepositoryInterface;
use Modules\Moabom\Apps\Contracts\GeneratedAppRepositoryInterface;
use Modules\Moabom\Apps\Repositories\AiGenerationSessionRepository;
use Modules\Moabom\Apps\Repositories\GeneratedAppRepository;

class AppsServiceProvider extends BaseModuleServiceProvider
{
    protected string $moduleIdentifier = 'moabom-apps';

    /**
     * Repository 인터페이스와 구현체 매핑
     *
     * @var array<class-string, class-string>
     */
    protected array $repositories = [
        GeneratedAppRepositoryInterface::class => GeneratedAppRepository::class,
        AiGenerationSessionRepositoryInterface::class => AiGenerationSessionRepository::class,
    ];

    public function register(): void
    {
        parent::register();

        $this->mergeConfigFrom(
            dirname(__DIR__, 2).'/config/moabom-apps.php',
            'moabom-apps',
        );

        // 앱 SDK 레지스트리 (Phase 4) — 활성 모듈 app.json 집계.
        $this->app->singleton(AppRegistryInterface::class, AppRegistry::class);

        $this->commands([
            MakeAppCommand::class,
        ]);
    }

    public function boot(): void
    {
        parent::boot();

        // shell-boot apps[] 기여 — moabom-system 이 moabom-apps 를 직접 의존하지 않도록
        // HookManager 필터로 결합도를 끊는다(C4 친화). moabom-apps 활성 시에만 등록됨.
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
    }
}
