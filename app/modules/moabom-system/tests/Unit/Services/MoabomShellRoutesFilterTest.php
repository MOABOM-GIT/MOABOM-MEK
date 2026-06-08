<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Services;

use Modules\Moabom\System\Services\MoabomShellRoutesFilter;
use PHPUnit\Framework\TestCase;

class MoabomShellRoutesFilterTest extends TestCase
{
    public function test_non_moabom_basic_template_returns_routes_unchanged(): void
    {
        $filter = new MoabomShellRoutesFilter;
        $routes = [
            ['path' => '/shop', 'layout' => 'x'],
        ];

        $this->assertSame($routes, $filter->filterForShell($routes, 'sirsoft-basic'));
    }

    public function test_moabom_basic_removes_ecommerce_paths_and_layouts(): void
    {
        $filter = new MoabomShellRoutesFilter;
        $routes = [
            ['path' => '/shop', 'layout' => 'home'],
            ['path' => '/cart', 'layout' => 'home'],
            ['path' => '/checkout', 'layout' => 'home'],
            ['path' => '/orders', 'layout' => 'home'],
            ['path' => '/', 'layout' => 'sirsoft-ecommerce.checkout'],
            ['path' => '/about', 'layout' => 'page.about'],
        ];

        $out = $filter->filterForShell($routes, 'moabom-basic');

        $this->assertCount(1, $out);
        $this->assertSame('/about', $out[0]['path']);
        $this->assertSame('page.about', $out[0]['layout']);
    }
}
