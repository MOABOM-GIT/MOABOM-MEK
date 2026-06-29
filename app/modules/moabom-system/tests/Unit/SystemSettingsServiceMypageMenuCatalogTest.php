<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit;

use Modules\Moabom\System\Services\SystemSettingsService;
use PHPUnit\Framework\TestCase;

class SystemSettingsServiceMypageMenuCatalogTest extends TestCase
{
    public function test_apply_mypage_menu_catalog_overlays_defaults_by_id(): void
    {
        $service = new SystemSettingsService;
        $method = new \ReflectionMethod(SystemSettingsService::class, 'applyMypageMenuCatalogFromDefaults');
        $method->setAccessible(true);

        /** @var array<string, mixed> $result */
        $result = $method->invoke($service, [
            'menus' => [
                [
                    'id' => 'library',
                    'label' => '앱 보관함',
                    'description' => '구 설명',
                    'enabled' => true,
                    'guest_enabled' => true,
                    'order' => 40,
                ],
                [
                    'id' => 'activity',
                    'label' => '내 활동',
                    'description' => '구 설명',
                    'enabled' => false,
                    'guest_enabled' => false,
                    'order' => 50,
                ],
            ],
        ], [
            'menus' => [
                [
                    'id' => 'library',
                    'label' => '라이브러리',
                    'description' => '보관한 앱 관리',
                    'icon' => 'folder-open',
                ],
                [
                    'id' => 'activity',
                    'label' => '게시글 관리',
                    'description' => '글·댓글·반응',
                    'icon' => 'clock',
                ],
            ],
        ]);

        $this->assertSame('라이브러리', $result['menus'][0]['label']);
        $this->assertSame('보관한 앱 관리', $result['menus'][0]['description']);
        $this->assertSame('folder-open', $result['menus'][0]['icon']);
        $this->assertTrue($result['menus'][0]['enabled']);
        $this->assertSame('게시글 관리', $result['menus'][1]['label']);
        $this->assertFalse($result['menus'][1]['enabled']);
    }

    public function test_strip_mypage_menu_catalog_for_storage_keeps_operational_fields_only(): void
    {
        $service = new SystemSettingsService;
        $method = new \ReflectionMethod(SystemSettingsService::class, 'stripMypageMenuCatalogForStorage');
        $method->setAccessible(true);

        /** @var array<string, mixed> $result */
        $result = $method->invoke($service, [
            'menus' => [
                [
                    'id' => 'library',
                    'label' => '라이브러리',
                    'description' => '보관한 앱 관리',
                    'icon' => 'folder-open',
                    'enabled' => true,
                    'guest_enabled' => true,
                    'order' => 40,
                ],
            ],
        ]);

        $this->assertSame([
            'id' => 'library',
            'enabled' => true,
            'guest_enabled' => true,
            'order' => 40,
        ], $result['menus'][0]);
    }
}
