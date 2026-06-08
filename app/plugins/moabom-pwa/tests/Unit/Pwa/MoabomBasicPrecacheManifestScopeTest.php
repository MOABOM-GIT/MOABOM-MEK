<?php

declare(strict_types=1);

namespace Plugins\Moabom\Pwa\Tests\Unit\Pwa;

use PHPUnit\Framework\Attributes\Test;
use Plugins\Moabom\Pwa\Tests\PluginTestCase;

/**
 * moabom-basic PWA precache manifest가 셸 분리 번들·대형 앱 청크를 담지 않는지 검증한다(로드맵 B1).
 */
class MoabomBasicPrecacheManifestScopeTest extends PluginTestCase
{
    private function precacheManifestPath(): string
    {
        return base_path('templates/_bundled/moabom-basic/dist/pwa/precache-manifest.json');
    }

    #[Test]
    public function precache_manifest_excludes_shell_and_module_plugin_dist_chunks(): void
    {
        $path = $this->precacheManifestPath();
        if (! is_readable($path)) {
            $this->markTestSkipped('moabom-basic dist/pwa/precache-manifest.json 없음 — template:build moabom-basic 실행 후 재시도');
        }

        $decoded = json_decode((string) file_get_contents($path), true);
        $this->assertIsArray($decoded);

        foreach ($decoded as $entry) {
            $this->assertIsArray($entry);
            $url = (string) ($entry['url'] ?? '');
            $this->assertNotSame('', $url);
            $this->assertStringNotContainsString('moabom-shell-', $url, '셸 분리 번들은 precache에 포함하지 않는다');
            $this->assertStringNotContainsString('image-gallery-lightbox', $url, 'ImageGallery 라이트박스 지연 청크는 precache에 포함하지 않는다');
            $this->assertStringNotContainsString('/api/modules/', $url, '모듈 dist는 precache에 포함하지 않는다');
            $this->assertStringNotContainsString('/api/plugins/', $url, '플러그인 dist는 precache에 포함하지 않는다');
        }
    }
}
