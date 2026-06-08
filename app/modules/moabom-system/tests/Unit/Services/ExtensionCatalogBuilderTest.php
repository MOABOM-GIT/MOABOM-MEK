<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Services;

use App\Contracts\Extension\ModuleInterface;
use App\Enums\PermissionType;
use App\Extension\ModuleManager;
use App\Models\User;
use Mockery;
use Modules\Moabom\System\Services\ExtensionCatalogBuilder;
use Tests\TestCase;

class ExtensionCatalogBuilderTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_guest_sees_only_modules_without_permission_categories(): void
    {
        $open = Mockery::mock(ModuleInterface::class);
        $open->shouldReceive('getIdentifier')->andReturn('open-mod');
        $open->shouldReceive('getPermissions')->andReturn([]);

        $closed = Mockery::mock(ModuleInterface::class);
        $closed->shouldReceive('getIdentifier')->andReturn('closed-mod');
        $closed->shouldReceive('getPermissions')->andReturn([
            'categories' => [
                [
                    'identifier' => 'c',
                    'permissions' => [
                        ['action' => 'read', 'type' => 'user'],
                    ],
                ],
            ],
        ]);

        $manager = Mockery::mock(ModuleManager::class);
        $manager->shouldReceive('getActiveModules')->andReturn([
            'open-mod' => $open,
            'closed-mod' => $closed,
        ]);

        $builder = new ExtensionCatalogBuilder($manager);

        $this->assertSame(['open-mod'], $builder->getVisibleModuleIdentifiers(null));
    }

    public function test_authenticated_user_includes_module_when_any_leaf_permission_matches(): void
    {
        $user = Mockery::mock(User::class);
        $user->shouldReceive('isAdmin')->andReturn(false);
        $user->shouldReceive('hasPermission')->andReturnUsing(
            fn (string $id, ?PermissionType $type = null) => $id === 'shop-mod.products.read' && $type === PermissionType::User
        );

        $module = Mockery::mock(ModuleInterface::class);
        $module->shouldReceive('getIdentifier')->andReturn('shop-mod');
        $module->shouldReceive('getPermissions')->andReturn([
            'categories' => [
                [
                    'identifier' => 'products',
                    'permissions' => [
                        ['action' => 'read', 'type' => 'user'],
                    ],
                ],
            ],
        ]);

        $manager = Mockery::mock(ModuleManager::class);
        $manager->shouldReceive('getActiveModules')->andReturn(['shop-mod' => $module]);

        $builder = new ExtensionCatalogBuilder($manager);

        $this->assertSame(['shop-mod'], $builder->getVisibleModuleIdentifiers($user));
    }
}
