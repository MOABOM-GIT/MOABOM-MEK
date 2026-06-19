<?php

namespace Modules\Moabom\System\Tests\Unit;

use Illuminate\Support\Facades\Validator;
use Modules\Moabom\System\Http\Requests\StoreUserSystemSettingsRequest;
use Modules\Moabom\System\Tests\ModuleTestCase;

class StoreUserSystemSettingsRequestTest extends ModuleTestCase
{
    public function test_appearance_background_image_id_accepts_uploaded_uuid(): void
    {
        $rules = (new StoreUserSystemSettingsRequest)->rules();

        $passes = Validator::make(
            ['appearance' => ['backgroundImageId' => '550e8400-e29b-41d4-a716-446655440000']],
            $rules
        )->passes();

        $this->assertTrue($passes);
    }

    public function test_appearance_background_image_id_rejects_legacy_numeric_slot(): void
    {
        $rules = (new StoreUserSystemSettingsRequest)->rules();

        $passes = Validator::make(
            ['appearance' => ['backgroundImageId' => '11']],
            $rules
        )->passes();

        $this->assertFalse($passes);
    }

    public function test_appearance_background_image_id_accepts_empty_string(): void
    {
        $rules = (new StoreUserSystemSettingsRequest)->rules();

        $passes = Validator::make(
            ['appearance' => ['backgroundImageId' => '']],
            $rules
        )->passes();

        $this->assertTrue($passes);
    }

    public function test_preferences_language_accepts_supported_ui_locale(): void
    {
        $rules = (new StoreUserSystemSettingsRequest)->rules();

        $passes = Validator::make(
            ['preferences' => ['language' => 'ko']],
            $rules
        )->passes();

        $this->assertTrue($passes);
    }

    public function test_appearance_font_size_accepts_levels_one_through_five(): void
    {
        $rules = (new StoreUserSystemSettingsRequest)->rules();

        foreach ([1, 2, 3, 4, 5] as $level) {
            $passes = Validator::make(
                ['appearance' => ['fontSize' => $level]],
                $rules
            )->passes();

            $this->assertTrue($passes, "fontSize should accept level {$level}.");
        }
    }

    public function test_appearance_font_size_rejects_out_of_range(): void
    {
        $rules = (new StoreUserSystemSettingsRequest)->rules();

        $this->assertFalse(
            Validator::make(['appearance' => ['fontSize' => 0]], $rules)->passes()
        );
        $this->assertFalse(
            Validator::make(['appearance' => ['fontSize' => 6]], $rules)->passes()
        );
    }

    public function test_shell_home_main_app_order_accepts_generated_and_static_ids(): void
    {
        $rules = (new StoreUserSystemSettingsRequest)->rules();

        $passes = Validator::make([
            'shell' => [
                'home' => [
                    'mainAppOrder' => ['create-app', 'cpap-mask', 'generated-app-42'],
                ],
            ],
        ], $rules)->passes();

        $this->assertTrue($passes);
    }

    public function test_shell_home_main_app_order_rejects_invalid_id(): void
    {
        $rules = (new StoreUserSystemSettingsRequest)->rules();

        $passes = Validator::make([
            'shell' => [
                'home' => [
                    'mainAppOrder' => ['../../evil'],
                ],
            ],
        ], $rules)->passes();

        $this->assertFalse($passes);
    }
}
