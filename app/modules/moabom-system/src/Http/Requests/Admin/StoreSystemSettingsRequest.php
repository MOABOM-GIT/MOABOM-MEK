<?php

namespace Modules\Moabom\System\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSystemSettingsRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'mypage' => ['sometimes', 'array'],
            'mypage.menus' => ['sometimes', 'array'],
            'mypage.menus.*.id' => ['required_with:mypage.menus', 'string', 'max:50'],
            'mypage.menus.*.label' => ['sometimes', 'string', 'max:80'],
            'mypage.menus.*.description' => ['sometimes', 'nullable', 'string', 'max:120'],
            'mypage.menus.*.icon' => ['nullable', 'string', 'max:50'],
            'mypage.menus.*.enabled' => ['boolean'],
            'mypage.menus.*.guest_enabled' => ['boolean'],
            'mypage.menus.*.order' => ['integer', 'min:0', 'max:999'],
            'appearance' => ['sometimes', 'array'],
            'appearance.themes' => ['sometimes', 'array'],
            'appearance.themes.*.id' => ['required_with:appearance.themes', Rule::in(['light', 'dark', 'flat-light', 'flat-dark'])],
            'appearance.themes.*.label' => ['required_with:appearance.themes', 'string', 'max:80'],
            'appearance.themes.*.enabled' => ['boolean'],
            'appearance.point_color_presets' => ['sometimes', 'array'],
            'appearance.point_color_presets.*' => ['string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'appearance.font_size_default' => ['sometimes', 'integer', 'between:1,5'],
            'appearance.home_background_items' => ['sometimes', 'array'],
            'appearance.home_background_items.*' => ['array'],
            'appearance.home_background_items.*.id' => ['required', 'uuid'],
            'appearance.home_background_items.*.mode' => ['sometimes', Rule::in(['light', 'dark'])],
            'appearance.home_background_items.*.point_color' => ['sometimes', 'nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'preferences' => ['sometimes', 'array'],
            'preferences.languages' => ['sometimes', 'array'],
            'preferences.languages.*.id' => ['required_with:preferences.languages', Rule::in(['ko', 'en', 'ja', 'zh'])],
            'preferences.languages.*.label' => ['required_with:preferences.languages', 'string', 'max:80'],
            'preferences.languages.*.enabled' => ['boolean'],
            'preferences.system_options' => ['sometimes', 'array'],
            'preferences.system_options.*.id' => ['required_with:preferences.system_options', Rule::in(['sound', 'animation', 'haptic', 'notification_center', 'toast', 'push', 'weather'])],
            'preferences.system_options.*.label' => ['required_with:preferences.system_options', 'string', 'max:80'],
            'preferences.system_options.*.on_by_default' => ['boolean'],
            'preferences.system_options.*.default' => ['boolean'],
            'preferences.system_options.*.user_editable' => ['boolean'],
        ];
    }

    /**
     * 저장 가능한 설정만 반환합니다.
     *
     * @return array<string, mixed>
     */
    public function validatedSettings(): array
    {
        $data = $this->validated();

        if (isset($data['preferences']['system_options']) && is_array($data['preferences']['system_options'])) {
            foreach ($data['preferences']['system_options'] as $i => $row) {
                if (! is_array($row)) {
                    continue;
                }
                if (! isset($row['on_by_default']) && array_key_exists('default', $row)) {
                    $row['on_by_default'] = (bool) $row['default'];
                }
                unset($row['default']);
                $data['preferences']['system_options'][$i] = $row;
            }
        }

        if (isset($data['preferences']) && is_array($data['preferences'])) {
            unset($data['preferences']['default_language']);
        }

        if (isset($data['appearance']) && is_array($data['appearance'])) {
            foreach (['default_theme', 'default_point_color', 'default_background_image_id', 'background_image_ids', 'include_template_backgrounds'] as $legacyKey) {
                unset($data['appearance'][$legacyKey]);
            }
        }

        return $data;
    }
}
