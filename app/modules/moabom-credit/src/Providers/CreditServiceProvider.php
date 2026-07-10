<?php

namespace Modules\Moabom\Credit\Providers;

use App\Extension\BaseModuleServiceProvider;
use Modules\Moabom\Credit\Contracts\CreditRepositoryInterface;
use Modules\Moabom\Credit\Contracts\CreditSettingsServiceInterface;
use Modules\Moabom\Credit\Repositories\CreditRepository;
use Modules\Moabom\Credit\Services\CreditLevelService;
use Modules\Moabom\Credit\Services\CreditSettingsService;

class CreditServiceProvider extends BaseModuleServiceProvider
{
    protected string $moduleIdentifier = 'moabom-credit';

    /**
     * Repository 인터페이스와 구현체 매핑
     *
     * @var array<class-string, class-string>
     */
    protected array $repositories = [
        CreditRepositoryInterface::class => CreditRepository::class,
    ];

    /**
     * 서비스 바인딩을 등록합니다.
     */
    public function register(): void
    {
        parent::register();

        $this->app->bind(CreditSettingsServiceInterface::class, CreditSettingsService::class);
        $this->app->singleton(CreditLevelService::class);
    }
}
