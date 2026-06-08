<?php

namespace Plugins\Moabom\Pwa\Tests\Feature\Pwa;

use Illuminate\Http\Request;
use PHPUnit\Framework\Attributes\Test;
use Plugins\Moabom\Pwa\Http\Controllers\PwaManifestController;
use Plugins\Moabom\Pwa\Http\Controllers\PwaServiceWorkerController;
use Plugins\Moabom\Pwa\Services\PwaManifestBuilder;
use Plugins\Moabom\Pwa\Services\PwaVersionResolver;
use Plugins\Moabom\Pwa\Tests\PluginTestCase;

/**
 * Feature: moabom-pwa-service-worker
 *
 * 관리자 셸이 PWA manifest/SW 캐시 라우팅에 섞이지 않도록 회귀 가드를 둔다.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 11.2, 11.3
 */
class AdminShellBypassTest extends PluginTestCase
{
    private string $pwaDistDir;

    private string $swPath;

    private ?string $originalSw = null;

    protected function setUp(): void
    {
        parent::setUp();

        $this->pwaDistDir = base_path('templates/moabom-basic/dist/pwa');
        $this->swPath = $this->pwaDistDir.'/sw.bundled.js';

        if (! is_dir($this->pwaDistDir)) {
            mkdir($this->pwaDistDir, 0775, true);
        }

        $this->originalSw = is_file($this->swPath) ? (string) file_get_contents($this->swPath) : null;
    }

    protected function tearDown(): void
    {
        if ($this->originalSw === null) {
            if (is_file($this->swPath)) {
                unlink($this->swPath);
            }
        } else {
            file_put_contents($this->swPath, $this->originalSw);
        }

        parent::tearDown();
    }

    #[Test]
    public function manifest_response_does_not_reference_admin_template(): void
    {
        $request = Request::create('/api/plugins/moabom-pwa/manifest.webmanifest', 'GET');

        /** @var PwaManifestController $controller */
        $controller = $this->app->make(PwaManifestController::class);
        /** @var PwaManifestBuilder $builder */
        $builder = $this->app->make(PwaManifestBuilder::class);

        $response = $controller($request, $builder);

        $body = (string) $response->getContent();
        $this->assertStringNotContainsString('moabom-admin_basic', $body);
        $this->assertStringNotContainsString('sirsoft-admin_basic', $body);
    }

    #[Test]
    public function service_worker_body_bypasses_admin_and_non_user_template_assets(): void
    {
        if (! is_file($this->swPath)) {
            $this->markTestSkipped('templates/moabom-basic/dist/pwa/sw.bundled.js 가 없습니다. moabom-basic 빌드 후 실행하세요.');
        }

        /** @var PwaServiceWorkerController $controller */
        $controller = $this->app->make(PwaServiceWorkerController::class);
        /** @var PwaVersionResolver $resolver */
        $resolver = $this->app->make(PwaVersionResolver::class);

        $body = (string) $controller($resolver)->getContent();

        $this->assertMatchesRegularExpression('#/admin#', $body);
        $this->assertMatchesRegularExpression('#/api/admin#', $body);
        $this->assertStringContainsString('moabom-basic', $body);
        $this->assertStringNotContainsString('moabom-admin_basic', $body);
        $this->assertStringContainsString('/api/templates/assets/', $body);
    }
}
