<?php

namespace Modules\Moabom\Global\Search\Providers;

use App\Extension\BaseModuleServiceProvider;

class GlobalSearchServiceProvider extends BaseModuleServiceProvider
{
    protected string $moduleIdentifier = 'moabom-global-search';

    protected array $repositories = [];

    public function register(): void
    {
        parent::register();

        $this->mergeConfigFrom(
            dirname(__DIR__, 2).'/config/moabom-global-search.php',
            'moabom-global-search',
        );
    }
}
