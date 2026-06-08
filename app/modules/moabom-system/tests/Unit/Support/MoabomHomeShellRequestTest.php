<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Modules\Moabom\System\Support\MoabomHomeShellRequest;
use Modules\Moabom\System\Tests\ModuleTestCase;

class MoabomHomeShellRequestTest extends ModuleTestCase
{
    public function test_root_path_matches_home_shell(): void
    {
        Config::set('moabom-system.boot_asset_ghost', [
            'enabled' => true,
            'strip_deferred_on_request_paths' => [''],
        ]);
        $this->app->instance('request', Request::create('/', 'GET'));

        $this->assertTrue(MoabomHomeShellRequest::matchesCurrentRequest());
    }

    public function test_login_path_matches_home_shell_by_default(): void
    {
        Config::set('moabom-system.boot_asset_ghost', [
            'enabled' => true,
            'strip_deferred_on_request_paths' => ['', 'login', 'register', 'forgot-password', 'reset-password'],
        ]);
        $this->app->instance('request', Request::create('/login', 'GET'));

        $this->assertTrue(MoabomHomeShellRequest::matchesCurrentRequest());
    }

    public function test_shop_path_does_not_match_home_shell(): void
    {
        Config::set('moabom-system.boot_asset_ghost', [
            'enabled' => true,
            'strip_deferred_on_request_paths' => ['', 'login'],
        ]);
        $this->app->instance('request', Request::create('/shop/list', 'GET'));

        $this->assertFalse(MoabomHomeShellRequest::matchesCurrentRequest());
    }
}
