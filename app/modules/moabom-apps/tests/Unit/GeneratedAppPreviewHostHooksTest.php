<?php

namespace Modules\Moabom\Apps\Tests\Unit;

use App\Extension\HookManager;
use Modules\Moabom\Apps\Support\GeneratedAppPreviewRouting;
use Modules\Moabom\Apps\Tests\ModuleTestCase;
use Modules\Moabom\System\Saas\TenantHostParser;

class GeneratedAppPreviewHostHooksTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'moabom-apps.preview.routing' => GeneratedAppPreviewRouting::MODE_DEDICATED_HOST,
            'moabom-apps.preview.standard_host' => 'apps.mek360.com',
            'moabom-apps.preview.hosted_apps_domain' => 'apps.mek360.com',
            'moabom-system.saas.base_domain' => 'mek360.com',
            'moabom-system.saas.platform_hosts' => ['mek360.com', 'www.mek360.com'],
        ]);
    }

    public function test_override_host_parse_maps_apps_subdomain_to_platform_when_not_in_platform_hosts(): void
    {
        $parser = new TenantHostParser('mek360.com', ['mek360.com', 'www.mek360.com']);
        $parsed = $parser->parse('apps.mek360.com');

        $this->assertSame('tenant', $parsed['type']);
        $this->assertSame('apps', $parsed['slug']);

        $overridden = HookManager::applyFilters('moabom.saas.override_host_parse', $parsed, 'apps.mek360.com');

        $this->assertSame('platform', $overridden['type']);
        $this->assertSame('apps.mek360.com', $overridden['host']);
    }

    public function test_resolve_unknown_host_maps_standard_preview_host_to_platform(): void
    {
        $resolved = HookManager::applyFilters('moabom.saas.resolve_unknown_host', null, 'apps.mek360.com');

        $this->assertIsArray($resolved);
        $this->assertSame('platform', $resolved['type']);
        $this->assertSame('apps.mek360.com', $resolved['host']);
    }
}
