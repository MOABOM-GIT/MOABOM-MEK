<?php

namespace Modules\Moabom\Apps\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\Moabom\Apps\Enums\AppType;

class GenerateAiAppRequest extends FormRequest
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
            'prompt' => ['required', 'string', 'min:5', 'max:8000'],
            'app_type' => ['required', Rule::in(AppType::aiGeneratableValues())],
            'model_id' => ['required', Rule::in($this->allowedCreateAppModelIds())],
            'current_html' => ['sometimes', 'nullable', 'string', 'max:524288'],
        ];
    }

    /**
     * @return list<string>
     */
    private function allowedCreateAppModelIds(): array
    {
        return array_values(array_map(
            'strval',
            (array) config('moabom-apps.ai.create_app_allowed_model_ids', [
                'claude-sonnet',
                'claude-haiku',
                'gpt-code',
                'gpt-code-mini',
                'gemini-code',
                'gemini-code-lite',
            ]),
        ));
    }
}
