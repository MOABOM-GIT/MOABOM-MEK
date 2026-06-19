<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Saas;

use Modules\Moabom\System\Saas\TenantBaselineManifest;
use Modules\Moabom\System\Tests\ModuleTestCase;

final class TenantBaselineManifestTest extends ModuleTestCase
{
    public function test_loads_runtime_and_baseline_tables(): void
    {
        $manifest = new TenantBaselineManifest();

        $baseline = $manifest->baselineDbTables();
        $runtime = $manifest->runtimeDbTables();

        $this->assertContains('roles', $baseline);
        $this->assertContains('modules', $baseline);
        $this->assertContains('users', $runtime);
        $this->assertContains('attachments', $runtime);
        $this->assertContains('moabom_system_generated_apps', $runtime);
        $this->assertContains('moabom_ai_generation_sessions', $runtime);
        $this->assertNotContains('users', $baseline);
    }

    public function test_runtime_gcs_prefixes_include_attachments(): void
    {
        $manifest = new TenantBaselineManifest();

        $this->assertContains('attachments', $manifest->runtimeGcsPrefixes());
        $this->assertTrue($manifest->runtimeGcsModulesExceptSeed());
    }
}
