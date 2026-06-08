<?php

namespace Plugins\Moabom\Pwa\Tests\Feature\Pwa;

use Illuminate\Http\Response;
use PHPUnit\Framework\Attributes\Test;
use Plugins\Moabom\Pwa\Http\Controllers\PwaServiceWorkerController;
use Plugins\Moabom\Pwa\Services\PwaVersionResolver;
use Plugins\Moabom\Pwa\Tests\PluginTestCase;

/**
 * Feature: moabom-pwa-service-worker
 *
 * `/pwa/sw.js` 응답 헤더와 런타임 플레이스홀더 치환 계약을 검증한다.
 *
 * Validates: Requirements 1.3, 2.1, 2.2, 2.3
 */
class PwaServiceWorkerControllerTest extends PluginTestCase
{
    private string $pwaDistDir;

    private string $swPath;

    private string $manifestPath;

    private ?string $originalSw = null;

    private ?string $originalManifest = null;

    protected function setUp(): void
    {
        parent::setUp();

        $this->pwaDistDir = base_path('templates/moabom-basic/dist/pwa');
        $this->swPath = $this->pwaDistDir.'/sw.bundled.js';
        $this->manifestPath = $this->pwaDistDir.'/precache-manifest.json';

        if (! is_dir($this->pwaDistDir)) {
            mkdir($this->pwaDistDir, 0775, true);
        }

        $this->originalSw = is_file($this->swPath) ? (string) file_get_contents($this->swPath) : null;
        $this->originalManifest = is_file($this->manifestPath) ? (string) file_get_contents($this->manifestPath) : null;
    }

    protected function tearDown(): void
    {
        $this->restoreFile($this->swPath, $this->originalSw);
        $this->restoreFile($this->manifestPath, $this->originalManifest);

        parent::tearDown();
    }

    private function invoke(): Response
    {
        /** @var PwaServiceWorkerController $controller */
        $controller = $this->app->make(PwaServiceWorkerController::class);
        /** @var PwaVersionResolver $resolver */
        $resolver = $this->app->make(PwaVersionResolver::class);

        return $controller($resolver);
    }

    #[Test]
    public function it_returns_service_worker_headers(): void
    {
        file_put_contents($this->swPath, 'const version = "{{VERSION}}"; const precache = {{PRECACHE_MANIFEST}};');

        $response = $this->invoke();

        $this->assertSame(200, $response->getStatusCode());
        $this->assertStringStartsWith('application/javascript', (string) $response->headers->get('content-type'));
        $this->assertSame('/', $response->headers->get('service-worker-allowed'));
        $this->assertTrue($response->headers->hasCacheControlDirective('no-cache'));
    }

    #[Test]
    public function it_replaces_precache_manifest_and_version_placeholders(): void
    {
        file_put_contents(
            $this->swPath,
            'const version = "{{VERSION}}"; const precache = JSON.parse(\'__PRECACHE_MANIFEST_JSON__\'); const adminBypass = "/admin|/api/admin|moabom-basic";'
        );
        file_put_contents($this->manifestPath, '[{"url":"js/components.iife.js","revision":"abc"}]');

        $response = $this->invoke();
        $body = (string) $response->getContent();

        $this->assertStringNotContainsString('{{VERSION}}', $body);
        $this->assertStringNotContainsString('__PRECACHE_MANIFEST_JSON__', $body);
        $this->assertStringContainsString('JSON.parse("[{\"url\":\"js/components.iife.js\",\"revision\":\"abc\"}]")', $body);
        $this->assertMatchesRegularExpression('/const version = "[^"]+";/', $body);
    }

    #[Test]
    public function it_returns_noop_service_worker_when_bundle_is_missing(): void
    {
        $this->restoreFile($this->swPath, null);
        $this->restoreFile($this->manifestPath, null);

        $response = $this->invoke();
        $body = (string) $response->getContent();

        $this->assertSame(200, $response->getStatusCode());
        $this->assertStringContainsString('moabom-pwa-service-worker: no-op', $body);
        $this->assertSame('/', $response->headers->get('service-worker-allowed'));
    }

    #[Test]
    public function it_contains_admin_bypass_patterns_in_service_worker_body(): void
    {
        if (! is_file($this->swPath)) {
            $this->markTestSkipped('templates/moabom-basic/dist/pwa/sw.bundled.js 가 없습니다. moabom-basic 빌드 후 실행하세요.');
        }

        $response = $this->invoke();
        $body = (string) $response->getContent();

        $this->assertStringContainsString('/admin', $body);
        $this->assertStringContainsString('/api/admin', $body);
        $this->assertStringContainsString('moabom-basic', $body);
        $this->assertStringNotContainsString('moabom-admin_basic', $body);
        $this->assertStringContainsString('/api/templates/assets/', $body);
    }

    private function restoreFile(string $path, ?string $content): void
    {
        if ($content === null) {
            if (is_file($path)) {
                unlink($path);
            }

            return;
        }

        $dir = dirname($path);
        if (! is_dir($dir)) {
            mkdir($dir, 0775, true);
        }

        file_put_contents($path, $content);
    }
}
