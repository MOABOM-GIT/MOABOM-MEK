<?php

namespace Modules\Moabom\Apps\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\Moabom\Apps\Enums\AppTier;
use Modules\Moabom\Apps\Enums\AppType;
use Modules\Moabom\Apps\Rules\GeneratedAppHtmlSecurityRule;

class StoreGeneratedAppRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:120'],
            'app_type' => ['required', Rule::in(AppType::values())],
            'tier' => ['sometimes', Rule::in(AppTier::values())],
            'model_id' => ['nullable', 'string', 'max:60'],
            'prompt' => ['nullable', 'string', 'max:8000'],
            'html' => ['required', 'string', 'min:20', 'max:524288', new GeneratedAppHtmlSecurityRule],
            'is_shared' => ['sometimes', 'boolean'],
            'parent_app_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'version' => ['sometimes', 'integer', 'min:1'],
            'metadata' => ['sometimes', 'array'],
        ];
    }
}
