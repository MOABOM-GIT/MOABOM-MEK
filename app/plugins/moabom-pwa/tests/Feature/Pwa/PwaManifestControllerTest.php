<?php

namespace Plugins\Moabom\Pwa\Tests\Feature\Pwa;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Plugins\Moabom\Pwa\Http\Controllers\PwaManifestController;
use Plugins\Moabom\Pwa\Services\PwaManifestBuilder;
use Plugins\Moabom\Pwa\Tests\PluginTestCase;

/**
 * Feature: moabom-pwa-service-worker
 *
 * `PwaManifestController` 를 직접 invoke 하여 응답 헤더 · 본문 계약을 검증한다.
 * `src/routes/api.php` 는 `PluginRouteServiceProvider` 가 활성 디렉토리(`plugins/`)
 * 를 스캔해 로드하므로, `_bundled` 에서 테스트할 때는 컨트롤러를 직접 호출한다.
 *
 * 본 테스트는 `PluginTestCase` 가 등록한 `PwaServiceProvider` 를 통해 자동
 * 로드된 번역(`moabom-pwa::pwa.*`) 을 사용한다(Req 3.2/3.3).
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 8.4, 13.2
 */
class PwaManifestControllerTest extends PluginTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // supported_locales 확장 — 테스트 격리 범위에서만.
        $locales = ['ko', 'en', 'ja', 'zh'];
        Config::set('app.supported_locales', $locales);
    }

    private function invoke(string $acceptLanguage = ''): JsonResponse
    {
        $request = Request::create('/api/plugins/moabom-pwa/manifest.webmanifest', 'GET');
        if ($acceptLanguage !== '') {
            $request->headers->set('Accept-Language', $acceptLanguage);
        }

        /** @var PwaManifestController $controller */
        $controller = $this->app->make(PwaManifestController::class);
        /** @var PwaManifestBuilder $builder */
        $builder = $this->app->make(PwaManifestBuilder::class);

        return $controller($request, $builder);
    }

    #[Test]
    public function it_returns_application_manifest_json_content_type(): void
    {
        $response = $this->invoke();

        $this->assertSame(200, $response->getStatusCode());
        $this->assertStringStartsWith(
            'application/manifest+json',
            (string) $response->headers->get('content-type'),
        );
    }

    #[Test]
    public function it_sets_public_cache_control_max_age_300(): void
    {
        $response = $this->invoke();

        $this->assertTrue($response->headers->hasCacheControlDirective('public'));
        $this->assertSame('300', $response->headers->getCacheControlDirective('max-age'));
    }

    #[Test]
    public function it_includes_three_icons_with_correct_purpose_and_sizes(): void
    {
        $response = $this->invoke();
        $data = json_decode((string) $response->getContent(), true);

        $this->assertIsArray($data['icons']);
        $this->assertCount(3, $data['icons']);

        $bySize = [];
        foreach ($data['icons'] as $icon) {
            $bySize[$icon['sizes']] = $icon;
        }

        $this->assertArrayHasKey('192x192', $bySize);
        $this->assertSame('/api/templates/assets/moabom-basic/pwa/icons/icon-192.png', $bySize['192x192']['src']);
        $this->assertSame('any', $bySize['192x192']['purpose']);
        $this->assertSame('image/png', $bySize['192x192']['type']);

        $this->assertArrayHasKey('512x512', $bySize);
        $this->assertSame('/api/templates/assets/moabom-basic/pwa/icons/icon-512.png', $bySize['512x512']['src']);
        $this->assertSame('any maskable', $bySize['512x512']['purpose']);

        $this->assertArrayHasKey('180x180', $bySize);
        $this->assertSame('/api/templates/assets/moabom-basic/pwa/icons/apple-touch-icon-180.png', $bySize['180x180']['src']);
        $this->assertSame('any', $bySize['180x180']['purpose']);
    }

    #[Test]
    public function it_includes_start_url_scope_display_theme_and_background_colors(): void
    {
        $response = $this->invoke();
        $data = json_decode((string) $response->getContent(), true);

        $this->assertSame('/', $data['start_url']);
        $this->assertSame('/', $data['scope']);
        $this->assertSame('standalone', $data['display']);
        $this->assertMatchesRegularExpression('/^#[0-9a-fA-F]{6}$/', (string) $data['theme_color']);
        $this->assertMatchesRegularExpression('/^#[0-9a-fA-F]{6}$/', (string) $data['background_color']);
    }

    #[Test]
    #[DataProvider('localeProvider')]
    public function it_returns_localized_name_and_description(string $acceptLanguage, string $expectedDescription): void
    {
        $response = $this->invoke($acceptLanguage);
        $data = json_decode((string) $response->getContent(), true);

        $this->assertSame('Moabom', $data['name']);
        $this->assertSame('Moabom', $data['short_name']);
        $this->assertSame($expectedDescription, $data['description']);
    }

    /** @return array<string, array{0: string, 1: string}> */
    public static function localeProvider(): array
    {
        return [
            'ko' => ['ko-KR,ko;q=0.9,en;q=0.8', 'Moabom 사용자 커뮤니티 앱'],
            'en' => ['en-US,en;q=0.9', 'Moabom user community app'],
            'ja' => ['ja-JP,ja;q=0.9', 'Moabom ユーザーコミュニティアプリ'],
            'zh' => ['zh-CN,zh;q=0.9', 'Moabom 用户社区应用'],
        ];
    }

    #[Test]
    public function it_falls_back_when_accept_language_header_missing(): void
    {
        $response = $this->invoke();
        $data = json_decode((string) $response->getContent(), true);

        $this->assertArrayHasKey('description', $data);
        $this->assertNotSame('', $data['description']);
    }

    #[Test]
    public function it_does_not_reference_admin_template(): void
    {
        $response = $this->invoke();
        $body = (string) $response->getContent();

        $this->assertStringNotContainsString('moabom-admin_basic', $body);
    }
}
