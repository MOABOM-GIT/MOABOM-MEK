<?php

namespace Modules\Moabom\Consulting\Providers;

use App\Extension\BaseModuleServiceProvider;
use Modules\Moabom\Consulting\Contracts\ContractRepositoryInterface;
use Modules\Moabom\Consulting\Repositories\ContractRepository;

class ConsultingServiceProvider extends BaseModuleServiceProvider
{
    protected string $moduleIdentifier = 'moabom-consulting';

    /**
     * Repository 인터페이스와 구현체 매핑
     *
     * @var array<class-string, class-string>
     */
    protected array $repositories = [
        ContractRepositoryInterface::class => ContractRepository::class,
    ];
}
