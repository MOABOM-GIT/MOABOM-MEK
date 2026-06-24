<?php

namespace Modules\Moabom\System\Http\Requests;

use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Modules\Moabom\System\Contracts\SystemSettingsServiceInterface;
use Modules\Moabom\System\Support\MoabomUiLocales;

class StoreUserSystemSettingsRequest extends FormRequest
{
    /**
     * 관리자 Admin_Option_Config 색인 캐시 (`{id => ['user_editable','on_by_default']}`).
     * `prepareForValidation()` 에서 한 번만 로드하고 `rules()` · closure 규칙이 공유한다.
     *
     * null = 아직 로드 전, 빈 배열 = admin 측에 저장된 system_options 가 비어있음.
     *
     * @var array<string, array{user_editable: bool, on_by_default: bool}>|null
     */
    private ?array $adminSystemOptionIndex = null;

    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Admin_Option_Config 를 서비스에서 읽어와 id => config 로 색인한다.
     *
     * `rules()` 에서 closure 를 통해 `preferences.systemOptions` 를 검증할 때
     * 미지정 id / 잠긴 id 를 판정하는 근거다(Req 8.1 / 8.2).
     */
    protected function prepareForValidation(): void
    {
        $index = [];

        try {
            $service = app(SystemSettingsServiceInterface::class);
            $all = $service->getAllSettings();
            $options = $all['preferences']['system_options'] ?? [];

            if (is_array($options)) {
                foreach ($options as $row) {
                    if (! is_array($row)) {
                        continue;
                    }
                    $id = isset($row['id']) && is_string($row['id']) ? $row['id'] : null;
                    if ($id === null || $id === '') {
                        continue;
                    }

                    // 레거시 `default` 와 신규 `on_by_default` 둘 다 허용하여 baseline 을 추출한다.
                    $on = $row['on_by_default'] ?? $row['default'] ?? null;
                    $editable = $row['user_editable'] ?? true;

                    $index[$id] = [
                        'user_editable' => (bool) $editable,
                        'on_by_default' => (bool) $on,
                    ];
                }
            }
        } catch (\Throwable) {
            // 서비스 로드 실패 시에는 빈 색인으로 취급한다 —
            // 현재 저장된 관리자 옵션이 없다고 보고, 사용자가 어떤 id 를 보내든 "unknown" 으로 거절된다.
            // 결과적으로 요청은 422 로 거절되므로 잠금 우회 위험이 없다.
            $index = [];
        }

        $this->adminSystemOptionIndex = $index;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'version' => ['sometimes', 'integer', 'min:1'],
            'layout' => ['sometimes', 'array'],
            'layout.leftPanelOpen' => ['sometimes', 'boolean'],
            'layout.rightPanelOpen' => ['sometimes', 'boolean'],
            'layout.centerMode' => ['sometimes', Rule::in(['moabom-apps', 'sites', 'work'])],
            'appearance' => ['sometimes', 'array'],
            'appearance.theme' => ['sometimes', Rule::in(['light', 'dark', 'flat-light', 'flat-dark'])],
            'appearance.pointColor' => ['sometimes', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'appearance.fontSize' => ['sometimes', 'integer', 'between:1,5'],
            'appearance.backgroundImageId' => ['sometimes', 'nullable', 'string', 'max:36', function (string $attribute, mixed $value, Closure $fail): void {
                if (! is_string($value) || $value === '') {
                    return;
                }
                if (Str::isUuid($value)) {
                    return;
                }
                $fail(__('moabom-system::validation.invalid_background_image_id'));
            }],
            'preferences' => ['sometimes', 'array'],
            'preferences.language' => ['sometimes', Rule::in(MoabomUiLocales::allowedUiLocaleIds())],
            'preferences.systemOptions' => [
                'sometimes',
                'array',
                /*
                 * Req 8.1 / 8.2 — 관리자 잠금(`user_editable === false`) 옵션이나
                 * 관리자 측에 저장되지 않은(알 수 없는) id 가 포함되면 422 로 거절한다.
                 * 개별 필드(`*.sound` 등) 의 boolean 규칙은 아래에서 그대로 유지되어
                 * 기존 계약(Req 8.3) 을 깨지 않는다.
                 */
                function (string $attribute, mixed $value, Closure $fail): void {
                    if (! is_array($value)) {
                        return;
                    }

                    $index = $this->adminSystemOptionIndex ?? [];

                    foreach ($value as $id => $flag) {
                        if (! is_string($id) || $id === '') {
                            continue;
                        }

                        if (! array_key_exists($id, $index)) {
                            $fail(__('moabom-system::validation.system_option_unknown', ['id' => $id]));

                            continue;
                        }

                        if ($index[$id]['user_editable'] === false) {
                            $fail(__('moabom-system::validation.system_option_locked', ['id' => $id]));
                        }
                    }
                },
            ],
            'preferences.systemOptions.sound' => ['sometimes', 'boolean'],
            'preferences.systemOptions.animation' => ['sometimes', 'boolean'],
            'preferences.systemOptions.haptic' => ['sometimes', 'boolean'],
            'preferences.systemOptions.toast' => ['sometimes', 'boolean'],
            'preferences.systemOptions.weather' => ['sometimes', 'boolean'],
            'shell' => ['sometimes', 'array'],
            'shell.home' => ['sometimes', 'array'],
            'shell.home.mainAppOrder' => ['sometimes', 'array', 'max:64'],
            'shell.home.mainAppOrder.*' => ['string', 'max:128', 'regex:/^[a-z0-9][a-z0-9-]*$/'],
            'shell.home.mainAppOrderCustomized' => ['sometimes', 'boolean'],
            'shell.home.mainUnpinnedGeneratedIds' => ['sometimes', 'array', 'max:64'],
            'shell.home.mainUnpinnedGeneratedIds.*' => ['string', 'max:128', 'regex:/^generated-app-[0-9]+$/'],
        ];
    }
}
