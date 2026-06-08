<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Modules\Moabom\System\Saas\Usage\TenantUsageReporter;

/**
 * tenant purge/destroy 후 캐시 무효화.
 */
final class TenantCachePurger
{
    public function __construct(
        private readonly TenantRegistry $registry,
        private readonly TenantUsageReporter $usageReporter,
    ) {}

    public function purgeForTenant(TenantRecord $tenant): void
    {
        $this->registry->forgetHostCache($tenant->host);
        $this->usageReporter->forgetCache($tenant->slug);

        $slugToken = $tenant->slug;
        Cache::forget('g7_json_settings_category:'.$slugToken.':general');
        Cache::forget('g7_json_settings_category:'.$slugToken.':seo');

        try {
            Artisan::call('template:cache-clear');
        } catch (\Throwable) {
            // template command may be unavailable in tests
        }
    }

    public function purgeAfterDestroy(string $slug, string $host): void
    {
        $this->registry->forgetHostCache($host);
        $this->usageReporter->forgetCache($slug);

        try {
            Artisan::call('template:cache-clear');
        } catch (\Throwable) {
        }
    }
}
