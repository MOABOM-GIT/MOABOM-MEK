<?php

declare(strict_types=1);

namespace Plugins\Moabom\Pwa\Tests\Unit\Pwa;

use PHPUnit\Framework\Attributes\Test;
use Plugins\Moabom\Pwa\Tests\PluginTestCase;

/**
 * Service Worker 템플릿이 precache URL과 런타임 CacheFirst 이중 등록을 피하는 계약을 유지하는지 검증한다.
 */
class SwTemplatePrecacheExclusionTest extends PluginTestCase
{
    private function templatePath(): string
    {
        return $this->getPluginBasePath().'/resources/pwa/sw.template.js';
    }

    #[Test]
    public function sw_template_defines_precached_pathnames_and_runtime_exclusion(): void
    {
        $path = $this->templatePath();
        $this->assertFileExists($path);

        $src = (string) file_get_contents($path);
        $this->assertStringContainsString('precachedPathnames', $src);
        $this->assertStringContainsString('!precachedPathnames.has(path)', $src);
    }

    #[Test]
    public function sw_template_assets_route_uses_increased_max_entries_for_many_extensions(): void
    {
        $src = (string) file_get_contents($this->templatePath());
        $this->assertStringContainsString('maxEntries: 120', $src);
    }

    #[Test]
    public function sw_template_handles_moabom_lazy_precache_message(): void
    {
        $src = (string) file_get_contents($this->templatePath());
        $this->assertStringContainsString('MOABOM_LAZY_PRECACHE', $src);
        $this->assertStringContainsString('addUrlsToAssetsCache', $src);
    }

    #[Test]
    public function sw_template_handles_push_and_notificationclick(): void
    {
        $src = (string) file_get_contents($this->templatePath());
        $this->assertStringContainsString("addEventListener('push'", $src);
        $this->assertStringContainsString("addEventListener('notificationclick'", $src);
        $this->assertStringContainsString('showNotification', $src);
        $this->assertStringContainsString('MOABOM_FCM_PUSH_RECEIVED', $src);
        $this->assertStringContainsString('MOABOM_FCM_NOTIFICATION_CLICK', $src);
        $this->assertStringContainsString('client.postMessage(message)', $src);
        $this->assertStringNotContainsString('client.navigate(', $src);
    }
}
