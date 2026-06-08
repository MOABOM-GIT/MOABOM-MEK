<?php

namespace Plugins\Moabom\Pwa\Tests\Feature\Pwa;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use PHPUnit\Framework\Attributes\Test;
use Plugins\Moabom\Pwa\Http\Controllers\PwaVersionController;
use Plugins\Moabom\Pwa\Services\PwaVersionResolver;
use Plugins\Moabom\Pwa\Tests\PluginTestCase;

/**
 * Feature: moabom-pwa-service-worker
 *
 * `PwaVersionController` 응답 본문 · ETag · 304 계약을 검증한다.
 *
 * Validates: Requirements 4.1, 4.3, 4.4, 4.5, 4.6
 */
class PwaVersionControllerTest extends PluginTestCase
{
    private string $distFile;

    protected function setUp(): void
    {
        parent::setUp();

        $distDir = base_path('templates/moabom-basic/dist/css');
        if (! is_dir($distDir)) {
            mkdir($distDir, 0775, true);
        }

        $this->distFile = $distDir.'/pwa-version-test.css';
        file_put_contents($this->distFile, 'body{color:#111}');
        touch($this->distFile, time() - 10);
        clearstatcache(true, $this->distFile);
    }

    protected function tearDown(): void
    {
        if (isset($this->distFile) && is_file($this->distFile)) {
            unlink($this->distFile);
        }

        parent::tearDown();
    }

    private function invoke(?string $ifNoneMatch = null): Response|JsonResponse
    {
        $request = Request::create('/api/plugins/moabom-pwa/version', 'GET');
        if ($ifNoneMatch !== null) {
            $request->headers->set('If-None-Match', $ifNoneMatch);
        }

        /** @var PwaVersionController $controller */
        $controller = $this->app->make(PwaVersionController::class);
        /** @var PwaVersionResolver $resolver */
        $resolver = $this->app->make(PwaVersionResolver::class);

        return $controller($request, $resolver);
    }

    #[Test]
    public function it_returns_stable_version_for_same_mtime_snapshot(): void
    {
        $first = $this->invoke();
        $second = $this->invoke();

        $firstBody = json_decode((string) $first->getContent(), true);
        $secondBody = json_decode((string) $second->getContent(), true);

        $this->assertSame(200, $first->getStatusCode());
        $this->assertIsString($firstBody['version'] ?? null);
        $this->assertSame($firstBody['version'], $secondBody['version']);
    }

    #[Test]
    public function it_changes_version_when_dist_file_mtime_increases(): void
    {
        $first = $this->invoke();
        $firstBody = json_decode((string) $first->getContent(), true);

        touch($this->distFile, time() + 5);
        clearstatcache(true, $this->distFile);

        $second = $this->invoke();
        $secondBody = json_decode((string) $second->getContent(), true);

        $this->assertNotSame($firstBody['version'], $secondBody['version']);
    }

    #[Test]
    public function it_sets_etag_and_no_cache_headers(): void
    {
        $response = $this->invoke();
        $body = json_decode((string) $response->getContent(), true);

        $this->assertTrue($response->headers->hasCacheControlDirective('no-cache'));
        $this->assertSame('"'.$body['version'].'"', $response->headers->get('etag'));
    }

    #[Test]
    public function it_returns_304_when_if_none_match_matches_current_version(): void
    {
        $response = $this->invoke();
        $body = json_decode((string) $response->getContent(), true);

        $notModified = $this->invoke('"'.$body['version'].'"');

        $this->assertSame(304, $notModified->getStatusCode());
        $this->assertSame('', (string) $notModified->getContent());
        $this->assertSame('"'.$body['version'].'"', $notModified->headers->get('etag'));
        $this->assertTrue($notModified->headers->hasCacheControlDirective('no-cache'));
    }
}
