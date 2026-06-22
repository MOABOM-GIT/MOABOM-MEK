<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Http\Controllers;

use App\Services\TemplateService;
use Illuminate\Http\Request;
use Modules\Moabom\System\Http\Controllers\PublicTemplateRoutesShellController;
use Modules\Moabom\System\Http\Requests\Public\GetMoabomShellTemplateRoutesRequest;
use Modules\Moabom\System\Services\MoabomShellRoutesFilter;
use Tests\TestCase;

class PublicTemplateRoutesShellControllerTest extends TestCase
{
    public function test_shell_scope_filters_routes_for_moabom_basic(): void
    {
        $this->mock(TemplateService::class, function ($mock) {
            $mock->shouldReceive('getRoutesDataWithModules')
                ->once()
                ->with('moabom-basic')
                ->andReturn([
                    'success' => true,
                    'data' => [
                        'version' => '1',
                        'routes' => [
                            ['path' => '/shop', 'layout' => 'home'],
                            ['path' => '/', 'layout' => 'home'],
                        ],
                    ],
                ]);
        });

        $request = GetMoabomShellTemplateRoutesRequest::createFromBase(
            Request::create('http://localhost', 'GET', ['template' => 'moabom-basic', 'scope' => 'shell'])
        );
        $request->setContainer($this->app)->setRedirector($this->app->make('redirect'));
        $request->validateResolved();

        $response = (new PublicTemplateRoutesShellController)(
            $request,
            $this->app->make(TemplateService::class),
            new MoabomShellRoutesFilter,
        );

        $payload = $response->getData(true);
        $this->assertTrue($payload['success']);
        $paths = array_column($payload['data']['routes'], 'path');
        $this->assertContains('/', $paths);
        $this->assertNotContains('/shop', $paths);
        $this->assertContains('/404', $paths);
    }

    public function test_full_scope_does_not_filter_routes(): void
    {
        $this->mock(TemplateService::class, function ($mock) {
            $mock->shouldReceive('getRoutesDataWithModules')
                ->once()
                ->with('moabom-basic')
                ->andReturn([
                    'success' => true,
                    'data' => [
                        'version' => '1',
                        'routes' => [
                            ['path' => '/shop', 'layout' => 'home'],
                            ['path' => '/', 'layout' => 'home'],
                        ],
                    ],
                ]);
        });

        $request = GetMoabomShellTemplateRoutesRequest::createFromBase(
            Request::create('http://localhost', 'GET', ['template' => 'moabom-basic', 'scope' => 'full'])
        );
        $request->setContainer($this->app)->setRedirector($this->app->make('redirect'));
        $request->validateResolved();

        $response = (new PublicTemplateRoutesShellController)(
            $request,
            $this->app->make(TemplateService::class),
            new MoabomShellRoutesFilter,
        );

        $this->assertCount(2, $response->getData(true)['data']['routes']);
    }

    public function test_template_not_found_returns_404(): void
    {
        $this->mock(TemplateService::class, function ($mock) {
            $mock->shouldReceive('getRoutesDataWithModules')
                ->once()
                ->with('missing-tpl')
                ->andReturn([
                    'success' => false,
                    'error' => 'template_not_found',
                ]);
        });

        $request = GetMoabomShellTemplateRoutesRequest::createFromBase(
            Request::create('http://localhost', 'GET', ['template' => 'missing-tpl'])
        );
        $request->setContainer($this->app)->setRedirector($this->app->make('redirect'));
        $request->validateResolved();

        $response = (new PublicTemplateRoutesShellController)(
            $request,
            $this->app->make(TemplateService::class),
            new MoabomShellRoutesFilter,
        );

        $this->assertSame(404, $response->getStatusCode());
    }
}
