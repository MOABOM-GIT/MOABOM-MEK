<?php

namespace Modules\Moabom\Apps\Tests\Unit;

use Modules\Moabom\Apps\Support\GeneratedAppPreviewRouting;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

class GeneratedAppPreviewRoutingTest extends ModuleTestCase
{
    public function test_defaults_to_dedicated_host(): void
    {
        config([
            'moabom-apps.preview.routing' => '',
            'moabom-system.saas.enabled' => true,
        ]);

        $this->assertSame(GeneratedAppPreviewRouting::MODE_DEDICATED_HOST, GeneratedAppPreviewRouting::mode());
        $this->assertFalse(GeneratedAppPreviewRouting::usesTenantPath());
        $this->assertTrue(GeneratedAppPreviewRouting::usesDedicatedHost());
    }

    public function test_explicit_tenant_path_mode(): void
    {
        config([
            'moabom-apps.preview.routing' => GeneratedAppPreviewRouting::MODE_TENANT_PATH,
            'moabom-system.saas.enabled' => true,
        ]);

        $this->assertTrue(GeneratedAppPreviewRouting::usesTenantPath());
    }

    public function test_hosted_origin_for_app(): void
    {
        config([
            'moabom-apps.preview.scheme' => 'https',
            'moabom-apps.preview.hosted_apps_domain' => 'apps.mek360.com',
        ]);

        $this->assertSame('https://12.apps.mek360.com', GeneratedAppPreviewRouting::hostedOriginForApp(12));
    }

    public function test_local_path_fallbacks(): void
    {
        $this->assertSame('/modules/moabom-apps/preview/g/12', GeneratedAppPreviewRouting::standardPath(12));
        $this->assertSame('/modules/moabom-apps/preview/hosted/12', GeneratedAppPreviewRouting::hostedPath(12));
    }

    public function test_shell_frame_ancestors_includes_tenant_wildcard(): void
    {
        config([
            'moabom-apps.preview.scheme' => 'https',
            'moabom-apps.preview.hosted_base_domain' => 'mek360.com',
            'moabom-apps.preview.shell_frame_ancestors' => [
                'https://mek360.com',
                'https://www.mek360.com',
            ],
        ]);

        $ancestors = GeneratedAppPreviewRouting::shellFrameAncestors();

        $this->assertContains('https://mek360.com', $ancestors);
        $this->assertContains('https://www.mek360.com', $ancestors);
        $this->assertContains('https://*.mek360.com', $ancestors);
    }
}
