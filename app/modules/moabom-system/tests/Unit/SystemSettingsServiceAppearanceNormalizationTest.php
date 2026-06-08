<?php

namespace Modules\Moabom\System\Tests\Unit;

use Modules\Moabom\System\Services\SystemSettingsService;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

/**
 * SystemSettingsService 의 appearance 정규화(저장·조회) 단위 테스트.
 *
 * private 메서드(`stripAppearanceForStorage`·`enrichAppearanceForResponse`)를 Reflection 으로 호출해
 * Laravel Application / Storage 부트스트랩 없이 검증한다.
 */
class SystemSettingsServiceAppearanceNormalizationTest extends TestCase
{
    private static bool $autoloadRegistered = false;

    protected function setUp(): void
    {
        parent::setUp();

        if (! self::$autoloadRegistered) {
            $base = dirname(__DIR__, 2).'/src/';
            spl_autoload_register(function ($class) use ($base) {
                $prefix = 'Modules\\Moabom\\System\\';
                if (strncmp($prefix, $class, strlen($prefix)) !== 0) {
                    return;
                }
                $relative = substr($class, strlen($prefix));
                $file = $base.str_replace('\\', '/', $relative).'.php';
                if (file_exists($file)) {
                    require_once $file;
                }
            });
            self::$autoloadRegistered = true;
        }
    }

    private function invokeStripForStorage(array $appearance): array
    {
        $service = new SystemSettingsService;
        $method = new ReflectionMethod($service, 'stripAppearanceForStorage');
        $method->setAccessible(true);

        return $method->invoke($service, $appearance);
    }

    private function invokeEnrichForResponse(array $appearance): array
    {
        $service = new SystemSettingsService;
        $method = new ReflectionMethod($service, 'enrichAppearanceForResponse');
        $method->setAccessible(true);

        return $method->invoke($service, $appearance);
    }

    #[Test]
    public function strip_appearance_for_storage_keeps_mode_and_point_color(): void
    {
        $result = $this->invokeStripForStorage([
            'home_background_items' => [
                ['id' => '550e8400-e29b-41d4-a716-446655440000', 'mode' => 'dark', 'point_color' => '#6366f1'],
            ],
        ]);

        $this->assertSame(
            [
                [
                    'id' => '550e8400-e29b-41d4-a716-446655440000',
                    'mode' => 'dark',
                    'point_color' => '#6366f1',
                ],
            ],
            $result['home_background_items']
        );
    }

    #[Test]
    public function strip_appearance_for_storage_defaults_missing_mode_to_light(): void
    {
        $result = $this->invokeStripForStorage([
            'home_background_items' => [
                ['id' => '550e8400-e29b-41d4-a716-446655440000'],
            ],
        ]);

        $this->assertSame('light', $result['home_background_items'][0]['mode']);
        $this->assertNull($result['home_background_items'][0]['point_color']);
    }

    #[Test]
    public function strip_appearance_for_storage_rejects_invalid_point_color(): void
    {
        $result = $this->invokeStripForStorage([
            'home_background_items' => [
                ['id' => '550e8400-e29b-41d4-a716-446655440000', 'mode' => 'light', 'point_color' => 'not-a-color'],
            ],
        ]);

        $this->assertNull($result['home_background_items'][0]['point_color']);
    }

    #[Test]
    public function strip_appearance_for_storage_enforces_point_color_uniqueness(): void
    {
        $result = $this->invokeStripForStorage([
            'home_background_items' => [
                ['id' => '550e8400-e29b-41d4-a716-446655440000', 'mode' => 'light', 'point_color' => '#6366f1'],
                ['id' => '6ba7b810-9dad-41d1-80b4-00c04fd430c8', 'mode' => 'dark', 'point_color' => '#6366f1'],
                ['id' => '00000000-0000-4000-8000-000000000001', 'mode' => 'dark', 'point_color' => '#f657a6'],
            ],
        ]);

        // 첫 번째 항목만 #6366f1 유지, 두 번째 항목은 null 로 리셋
        $this->assertSame('#6366f1', $result['home_background_items'][0]['point_color']);
        $this->assertNull($result['home_background_items'][1]['point_color']);
        $this->assertSame('#f657a6', $result['home_background_items'][2]['point_color']);
    }

    #[Test]
    public function strip_appearance_for_storage_normalizes_point_color_case(): void
    {
        $result = $this->invokeStripForStorage([
            'home_background_items' => [
                ['id' => '550e8400-e29b-41d4-a716-446655440000', 'point_color' => '#FF00AA'],
            ],
        ]);

        $this->assertSame('#ff00aa', $result['home_background_items'][0]['point_color']);
    }

    #[Test]
    public function strip_appearance_for_storage_drops_non_uuid_items(): void
    {
        $result = $this->invokeStripForStorage([
            'home_background_items' => [
                ['id' => 'not-a-uuid', 'mode' => 'light'],
                ['id' => '550e8400-e29b-41d4-a716-446655440000', 'mode' => 'dark'],
            ],
        ]);

        $this->assertCount(1, $result['home_background_items']);
        $this->assertSame('550e8400-e29b-41d4-a716-446655440000', $result['home_background_items'][0]['id']);
    }

    #[Test]
    public function enrich_appearance_for_response_attaches_urls_and_defaults(): void
    {
        $result = $this->invokeEnrichForResponse([
            'home_background_items' => [
                ['id' => '550e8400-e29b-41d4-a716-446655440000'], // 구 저장본 — mode/point_color 누락
            ],
        ]);

        $row = $result['home_background_items'][0];
        $this->assertSame('550e8400-e29b-41d4-a716-446655440000', $row['id']);
        $this->assertSame('light', $row['mode']);
        $this->assertNull($row['point_color']);
        $this->assertSame('/api/modules/moabom-system/home-backgrounds/550e8400-e29b-41d4-a716-446655440000/full', $row['url']);
        $this->assertSame('/api/modules/moabom-system/home-backgrounds/550e8400-e29b-41d4-a716-446655440000/thumb', $row['thumb_url']);
    }

    #[Test]
    public function enrich_appearance_for_response_preserves_mode_and_point_color(): void
    {
        $result = $this->invokeEnrichForResponse([
            'home_background_items' => [
                ['id' => '550e8400-e29b-41d4-a716-446655440000', 'mode' => 'dark', 'point_color' => '#6366f1'],
            ],
        ]);

        $row = $result['home_background_items'][0];
        $this->assertSame('dark', $row['mode']);
        $this->assertSame('#6366f1', $row['point_color']);
    }
}
