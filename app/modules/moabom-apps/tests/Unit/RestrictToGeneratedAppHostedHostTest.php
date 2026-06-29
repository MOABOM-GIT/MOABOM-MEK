<?php

namespace Modules\Moabom\Apps\Tests\Unit;

use Illuminate\Http\Request;
use Modules\Moabom\Apps\Http\Middleware\RestrictToGeneratedAppHostedHost;
use Modules\Moabom\Apps\Support\GeneratedAppHostParser;
use Modules\Moabom\Apps\Support\GeneratedAppPreviewRouting;
use Modules\Moabom\Apps\Tests\ModuleTestCase;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class RestrictToGeneratedAppHostedHostTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'moabom-apps.preview.routing' => GeneratedAppPreviewRouting::MODE_DEDICATED_HOST,
            'moabom-apps.preview.standard_host' => 'apps.mek360.com',
            'moabom-apps.preview.hosted_apps_domain' => 'apps.mek360.com',
        ]);
    }

    public function test_allows_hosted_app_subdomain_and_sets_app_id(): void
    {
        $request = Request::create('https://26.apps.mek360.com/api/data/calc_logs', 'POST');
        $called = false;

        $response = (new RestrictToGeneratedAppHostedHost(new GeneratedAppHostParser))
            ->handle($request, function (Request $nextRequest) use (&$called) {
                $called = true;
                $this->assertSame(26, $nextRequest->attributes->get('moabom_generated_app_id'));

                return response('ok');
            });

        $this->assertTrue($called);
        $this->assertSame(200, $response->getStatusCode());
    }

    public function test_rejects_non_hosted_host(): void
    {
        $this->expectException(NotFoundHttpException::class);

        $request = Request::create('https://smoke.mek360.com/api/data/calc_logs', 'POST');

        (new RestrictToGeneratedAppHostedHost(new GeneratedAppHostParser))
            ->handle($request, fn () => response('ok'));
    }
}
