<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Tests\Unit;

use Modules\Moabom\Apps\Contracts\GeneratedAppRepositoryInterface;
use Modules\Moabom\Apps\Models\GeneratedApp;
use Modules\Moabom\Apps\Support\ShellRankingGeneratedAppScope;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

final class ShellRankingGeneratedAppScopeTest extends ModuleTestCase
{
    protected function tearDown(): void
    {
        ShellRankingGeneratedAppScope::resetAllowedCacheForTest();
        parent::tearDown();
    }

    public function test_allows_builtin_shell_apps_without_catalog_lookup(): void
    {
        $repository = $this->createMock(GeneratedAppRepositoryInterface::class);
        $repository->expects($this->never())->method('getPublished');

        $scope = new ShellRankingGeneratedAppScope($repository);

        $this->assertTrue($scope->allowsShellAppId('cpap-mask'));
        $this->assertTrue($scope->allowsShellAppId('hospital-info'));
    }

    public function test_filters_generated_apps_to_published_catalog_scope(): void
    {
        $published = new GeneratedApp;
        $published->id = 7;

        $repository = $this->createMock(GeneratedAppRepositoryInterface::class);
        $repository->expects($this->once())
            ->method('getPublished')
            ->with(500)
            ->willReturn(collect([$published]));

        $scope = new ShellRankingGeneratedAppScope($repository);

        $this->assertTrue($scope->allowsShellAppId('generated-app-7'));
        $this->assertFalse($scope->allowsShellAppId('generated-app-1'));

        $filtered = $scope->filterAppScoreRows([
            ['app_id' => 'cpap-mask', 'score' => 100],
            ['app_id' => 'generated-app-1', 'score' => 90],
            ['app_id' => 'generated-app-7', 'score' => 80],
        ]);

        $this->assertSame(
            ['cpap-mask', 'generated-app-7'],
            array_column($filtered, 'app_id'),
        );
    }
}
