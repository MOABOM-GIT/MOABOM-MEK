<?php

namespace Modules\Moabom\Apps\Tests\Feature;

use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Route;
use Modules\Moabom\Apps\Enums\AppTier;
use Modules\Moabom\Apps\Http\Controllers\GeneratedAppPreviewController;
use Modules\Moabom\Apps\Http\Middleware\RestrictToGeneratedAppHostedHost;
use Modules\Moabom\Apps\Models\GeneratedApp;
use Modules\Moabom\Apps\Support\GeneratedAppPreviewRouting;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

class GeneratedAppHostedDataApiTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'moabom-apps.preview.routing' => GeneratedAppPreviewRouting::MODE_DEDICATED_HOST,
            'moabom-apps.preview.hosted_apps_domain' => 'apps.mek360.com',
        ]);

        Route::middleware(['web', RestrictToGeneratedAppHostedHost::class])
            ->withoutMiddleware([VerifyCsrfToken::class])
            ->group(function (): void {
                Route::post('api/data/{tableKey}', [GeneratedAppPreviewController::class, 'storeHostedDataByHost'])
                    ->where('tableKey', '[A-Za-z0-9_-]+');
            });
    }

    public function test_post_without_csrf_is_not_rejected_with_419(): void
    {
        $app = GeneratedAppsConnection::apps()->create([
            'user_id' => 1,
            'title' => 'Calc',
            'app_type' => 'general',
            'tier' => AppTier::Hosted->value,
            'html' => '<!DOCTYPE html><html><head></head><body>ok</body></html>',
            'visibility' => 'private',
            'version' => 1,
            'hosted_subdomain' => '26',
            'provision_status' => 'ready',
        ]);

        $response = $this
            ->withServerVariables(['HTTP_HOST' => $app->id.'.apps.mek360.com'])
            ->postJson('/api/data/calc_logs', ['payload' => ['value' => 1]], [
                'X-Moabom-Preview-Token' => 'invalid-token',
            ]);

        $this->assertNotSame(419, $response->getStatusCode());
        $response->assertNotFound();
    }
}
