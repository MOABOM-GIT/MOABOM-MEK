<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Tests\Unit;

use App\Extension\ModuleManager;
use Mockery;
use Modules\Moabom\Apps\Apps\AppRegistry;
use Tests\TestCase;

/**
 * 앱 SDK 레지스트리 스냅샷 (Phase 4) — app.json 집계 결과가 기존 하드코딩과 1:1.
 *
 * 기존 프론트 SHELL_APP_CHUNK_FILES:
 *   create-app → moabom-shell-create-app.iife.js  (moabom-apps)
 *   cpap-mask  → moabom-shell-cpap-mask.iife.js   (moabom-cpap)
 *   consulting → moabom-shell-consulting.iife.js   (moabom-consulting)
 */
class AppRegistrySnapshotTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    /**
     * @param  list<string>  $activeIds
     */
    private function registryWithActive(array $activeIds): AppRegistry
    {
        $modules = [];
        foreach ($activeIds as $id) {
            $module = Mockery::mock();
            $module->shouldReceive('getIdentifier')->andReturn($id);
            $modules[$id] = $module;
        }

        $manager = Mockery::mock(ModuleManager::class);
        $manager->shouldReceive('getActiveModules')->andReturn($modules);

        return new AppRegistry($manager);
    }

    /**
     * @param  list<array<string, mixed>>  $apps
     */
    private function chunkFor(array $apps, string $appId): ?string
    {
        foreach ($apps as $app) {
            if (($app['id'] ?? null) === $appId) {
                return $app['frontend']['chunk'] ?? null;
            }
        }

        return null;
    }

    public function test_registry_aggregates_active_module_manifests_matching_hardcoded_chunks(): void
    {
        $apps = $this->registryWithActive(['moabom-apps', 'moabom-cpap', 'moabom-consulting'])->forShell('moabom-basic');

        $this->assertSame('moabom-shell-create-app.iife.js', $this->chunkFor($apps, 'create-app'));
        $this->assertSame('moabom-shell-cpap-mask.iife.js', $this->chunkFor($apps, 'cpap-mask'));
        $this->assertSame('moabom-shell-consulting.iife.js', $this->chunkFor($apps, 'consulting'));
    }

    public function test_inactive_module_apps_are_excluded(): void
    {
        // moabom-cpap 비활성 → cpap-mask 제외(테넌트 필터).
        $apps = $this->registryWithActive(['moabom-apps'])->forShell('moabom-basic');

        $this->assertNotNull($this->chunkFor($apps, 'create-app'));
        $this->assertNull($this->chunkFor($apps, 'cpap-mask'));
    }

    public function test_template_filter_excludes_other_templates(): void
    {
        // 두 앱 모두 frontend.template = moabom-basic → 다른 템플릿엔 노출 안 됨.
        $apps = $this->registryWithActive(['moabom-apps', 'moabom-cpap', 'moabom-consulting'])->forShell('some-admin-template');

        $this->assertNull($this->chunkFor($apps, 'create-app'));
        $this->assertNull($this->chunkFor($apps, 'cpap-mask'));
        $this->assertNull($this->chunkFor($apps, 'consulting'));
    }

    public function test_manifests_are_ordered_by_order_field(): void
    {
        $manifests = $this->registryWithActive(['moabom-apps', 'moabom-cpap', 'moabom-consulting'])->all();
        $ids = array_map(static fn ($m) => $m->id, $manifests);

        $consultingIdx = array_search('consulting', $ids, true);
        $cpapIdx = array_search('cpap-mask', $ids, true);
        $createIdx = array_search('create-app', $ids, true);

        $this->assertNotFalse($consultingIdx);
        $this->assertNotFalse($cpapIdx);
        $this->assertNotFalse($createIdx);
        // consulting(order 5) < cpap-mask(order 10) < create-app(order 20)
        $this->assertLessThan($cpapIdx, $consultingIdx);
        // cpap-mask(order 10) < create-app(order 20)
        $this->assertLessThan($createIdx, $cpapIdx);
    }
}
