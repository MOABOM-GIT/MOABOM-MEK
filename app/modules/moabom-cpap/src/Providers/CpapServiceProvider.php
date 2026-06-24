<?php

namespace Modules\Moabom\Cpap\Providers;

use App\Extension\BaseModuleServiceProvider;
use Modules\Moabom\Cpap\Contracts\CpapMeasurementRepositoryInterface;
use Modules\Moabom\Cpap\Repositories\CpapMeasurementRepository;

class CpapServiceProvider extends BaseModuleServiceProvider
{
    protected string $moduleIdentifier = 'moabom-cpap';

    /**
     * Repository 인터페이스와 구현체 매핑
     *
     * @var array<class-string, class-string>
     */
    protected array $repositories = [
        CpapMeasurementRepositoryInterface::class => CpapMeasurementRepository::class,
    ];

    public function register(): void
    {
        parent::register();

        $this->mergeConfigFrom(
            dirname(__DIR__, 2).'/config/moabom-cpap.php',
            'moabom-cpap',
        );
    }
}
