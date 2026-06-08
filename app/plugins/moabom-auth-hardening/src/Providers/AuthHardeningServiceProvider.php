<?php

namespace Plugins\Moabom\Auth\Hardening\Providers;

use Illuminate\Contracts\Http\Kernel;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;
use Plugins\Moabom\Auth\Hardening\Http\Middleware\SecurityHeadersMiddleware;

class AuthHardeningServiceProvider extends ServiceProvider
{
    /**
     * 플러그인 미들웨어를 등록합니다.
     */
    public function boot(Kernel $kernel): void
    {
        if (! $this->canRegisterMiddleware()) {
            return;
        }

        $kernel->pushMiddleware(SecurityHeadersMiddleware::class);
    }

    private function canRegisterMiddleware(): bool
    {
        if (! file_exists(base_path('.env'))) {
            return false;
        }

        if (! config('app.installer_completed')) {
            try {
                return Schema::hasTable('plugins');
            } catch (\Throwable) {
                return false;
            }
        }

        return true;
    }
}
