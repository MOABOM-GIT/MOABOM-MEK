<?php

namespace Modules\Moabom\System\Tests\Unit;

use Illuminate\Translation\ArrayLoader;
use Illuminate\Translation\Translator;
use Illuminate\Validation\Factory as ValidationFactory;
use Illuminate\Validation\Validator;
use Modules\Moabom\System\Http\Requests\Admin\StoreSystemSettingsRequest;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

/**
 * FormRequest 검증 규칙 단위 테스트.
 *
 * Laravel Application 부트스트랩 없이 Illuminate\Validation 팩토리를 직접 구성해 검증해서
 * DB/라우트/모듈 로더 상태에 영향받지 않습니다.
 */
class StoreSystemSettingsRequestTest extends TestCase
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

    private function rules(): array
    {
        return (new StoreSystemSettingsRequest)->rules();
    }

    private function validate(array $data): Validator
    {
        $loader = new ArrayLoader;
        $translator = new Translator($loader, 'en');
        $factory = new ValidationFactory($translator);

        return $factory->make($data, $this->rules());
    }

    #[Test]
    public function point_color_presets_allow_more_than_nine_items(): void
    {
        $presets = array_fill(0, 12, '#6366f1');

        $this->assertTrue(
            $this->validate(['appearance' => ['point_color_presets' => $presets]])->passes(),
            'point_color_presets should allow arbitrary length.'
        );
    }

    #[Test]
    public function point_color_presets_still_reject_non_hex_values(): void
    {
        $this->assertFalse(
            $this->validate(['appearance' => ['point_color_presets' => ['not-a-color']]])->passes(),
            'Hex pattern must still be enforced per item.'
        );
    }

    #[Test]
    public function home_background_items_allow_more_than_twenty_four_items(): void
    {
        $items = [];
        for ($i = 0; $i < 30; $i++) {
            $items[] = [
                'id' => sprintf(
                    '%08x-%04x-4%03x-%04x-%012x',
                    random_int(0, 0xFFFFFFFF),
                    random_int(0, 0xFFFF),
                    random_int(0, 0xFFF),
                    0x8000 | random_int(0, 0x3FFF),
                    random_int(0, 0xFFFFFFFFFFFF)
                ),
            ];
        }

        $this->assertTrue(
            $this->validate(['appearance' => ['home_background_items' => $items]])->passes(),
            'home_background_items should allow more than 24 UUID entries.'
        );
    }

    #[Test]
    public function home_background_items_still_require_uuid(): void
    {
        $this->assertFalse(
            $this->validate(['appearance' => ['home_background_items' => [['id' => 'not-a-uuid']]]])->passes(),
            'home_background_items.*.id must still be a UUID.'
        );
    }

    #[Test]
    public function home_background_items_accept_mode_and_point_color(): void
    {
        $this->assertTrue(
            $this->validate([
                'appearance' => [
                    'home_background_items' => [
                        ['id' => '550e8400-e29b-41d4-a716-446655440000', 'mode' => 'light', 'point_color' => '#6366f1'],
                        ['id' => '6ba7b810-9dad-41d1-80b4-00c04fd430c8', 'mode' => 'dark', 'point_color' => null],
                    ],
                ],
            ])->passes(),
            'home_background_items should accept optional mode and point_color fields.'
        );
    }

    #[Test]
    public function home_background_items_reject_invalid_mode(): void
    {
        $this->assertFalse(
            $this->validate([
                'appearance' => [
                    'home_background_items' => [
                        ['id' => '550e8400-e29b-41d4-a716-446655440000', 'mode' => 'sepia'],
                    ],
                ],
            ])->passes(),
            'home_background_items.*.mode must be light or dark.'
        );
    }

    #[Test]
    public function home_background_items_reject_non_hex_point_color(): void
    {
        $this->assertFalse(
            $this->validate([
                'appearance' => [
                    'home_background_items' => [
                        ['id' => '550e8400-e29b-41d4-a716-446655440000', 'point_color' => 'purple'],
                    ],
                ],
            ])->passes(),
            'home_background_items.*.point_color must match hex pattern.'
        );
    }

    #[Test]
    public function font_size_default_accepts_levels_one_through_five(): void
    {
        foreach ([1, 2, 3, 4, 5] as $level) {
            $this->assertTrue(
                $this->validate(['appearance' => ['font_size_default' => $level]])->passes(),
                "font_size_default should accept level {$level}."
            );
        }
    }

    #[Test]
    public function font_size_default_rejects_out_of_range_values(): void
    {
        $this->assertFalse(
            $this->validate(['appearance' => ['font_size_default' => 0]])->passes(),
            'font_size_default must reject 0.'
        );
        $this->assertFalse(
            $this->validate(['appearance' => ['font_size_default' => 6]])->passes(),
            'font_size_default must reject 6.'
        );
        $this->assertFalse(
            $this->validate(['appearance' => ['font_size_default' => 'big']])->passes(),
            'font_size_default must reject non-integer values.'
        );
    }

    #[Test]
    public function legacy_background_image_ids_and_include_template_backgrounds_are_stripped(): void
    {
        // FormRequest 가 해당 키에 대한 규칙을 더 이상 갖고 있지 않아야 한다.
        $rules = $this->rules();
        $this->assertArrayNotHasKey('appearance.background_image_ids', $rules);
        $this->assertArrayNotHasKey('appearance.background_image_ids.*', $rules);
        $this->assertArrayNotHasKey('appearance.include_template_backgrounds', $rules);

        // 요청에 들어와도 validator 는 통과(무시)되지만 validatedSettings() 에서 제거된다.
        $request = new StoreSystemSettingsRequest;
        $data = [
            'appearance' => [
                'point_color_presets' => ['#6366f1'],
                'background_image_ids' => ['1', '2', '3'],
                'include_template_backgrounds' => false,
                'home_background_items' => [],
            ],
        ];

        // FormRequest 자체는 들어온 키를 valid data 에 포함하지 않으므로(규칙 없음) 기본적으로 반영되지 않는다.
        // 통과 여부만 확인한다.
        $this->assertTrue($this->validate($data)->passes());
    }
}
