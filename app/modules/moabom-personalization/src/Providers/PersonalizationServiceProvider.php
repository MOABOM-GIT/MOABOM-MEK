<?php

namespace Modules\Moabom\Personalization\Providers;

use App\Extension\BaseModuleServiceProvider;
use Modules\Moabom\Personalization\Contracts\UserActivityRepositoryInterface;
use Modules\Moabom\Personalization\Repositories\UserActivityRepository;

class PersonalizationServiceProvider extends BaseModuleServiceProvider
{
    protected string $moduleIdentifier = 'moabom-personalization';

    /**
     * Repository 인터페이스와 구현체 매핑
     *
     * @var array<class-string, class-string>
     */
    protected array $repositories = [
        UserActivityRepositoryInterface::class => UserActivityRepository::class,
    ];
}
