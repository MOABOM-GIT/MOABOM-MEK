<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Extension;

use App\Contracts\Repositories\MenuRepositoryInterface;
use App\Contracts\Repositories\RoleRepositoryInterface;
use App\Enums\ExtensionOwnerType;
use App\Models\Menu;
use Mockery;
use Modules\Moabom\System\Extension\MoabomExtensionMenuSyncHelper;
use Tests\TestCase;

class MoabomExtensionMenuSyncHelperTest extends TestCase
{
    public function test_resolves_parent_slug_at_top_level(): void
    {
        $menuRepository = Mockery::mock(MenuRepositoryInterface::class);
        $roleRepository = Mockery::mock(RoleRepositoryInterface::class);

        $platformMenu = Mockery::mock(Menu::class)->makePartial();
        $platformMenu->id = 50;

        $newMenu = Mockery::mock(Menu::class)->makePartial();
        $newMenu->id = 51;

        $menuRepository
            ->shouldReceive('findBySlug')
            ->once()
            ->with('platform-settings')
            ->andReturn($platformMenu);

        $menuRepository
            ->shouldReceive('findBySlugAndExtension')
            ->with('leaf', ExtensionOwnerType::Module, 'test-mod')
            ->once()
            ->andReturn(null);

        $menuRepository
            ->shouldReceive('updateOrCreate')
            ->once()
            ->with(
                Mockery::on(fn ($c) => $c['slug'] === 'leaf'),
                Mockery::on(fn ($v) => $v['parent_id'] === 50)
            )
            ->andReturn($newMenu);

        $helper = new MoabomExtensionMenuSyncHelper($menuRepository, $roleRepository);

        $result = $helper->syncMenuRecursive(
            [
                'slug' => 'leaf',
                'name' => ['ko' => '잎', 'en' => 'Leaf'],
                'parent_slug' => 'platform-settings',
            ],
            ExtensionOwnerType::Module,
            'test-mod',
        );

        $this->assertSame($newMenu, $result);
    }

    public function test_parent_slug_ignored_when_parent_id_from_recursion(): void
    {
        $menuRepository = Mockery::mock(MenuRepositoryInterface::class);
        $roleRepository = Mockery::mock(RoleRepositoryInterface::class);

        $menuRepository->shouldNotReceive('findBySlug');

        $childMenu = Mockery::mock(Menu::class)->makePartial();
        $childMenu->id = 61;

        $menuRepository
            ->shouldReceive('findBySlugAndExtension')
            ->with('child', ExtensionOwnerType::Module, 'test-mod')
            ->once()
            ->andReturn(null);

        $menuRepository
            ->shouldReceive('updateOrCreate')
            ->once()
            ->with(
                Mockery::on(fn ($c) => $c['slug'] === 'child'),
                Mockery::on(fn ($v) => $v['parent_id'] === 60)
            )
            ->andReturn($childMenu);

        $helper = new MoabomExtensionMenuSyncHelper($menuRepository, $roleRepository);

        $result = $helper->syncMenuRecursive(
            [
                'slug' => 'child',
                'name' => ['ko' => '자식', 'en' => 'Child'],
                'parent_slug' => 'ignored',
            ],
            ExtensionOwnerType::Module,
            'test-mod',
            60,
        );

        $this->assertSame($childMenu, $result);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }
}
