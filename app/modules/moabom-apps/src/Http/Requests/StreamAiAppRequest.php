<?php

namespace Modules\Moabom\Apps\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\Moabom\Apps\Enums\AppTier;
use Modules\Moabom\Apps\Enums\AppType;

class StreamAiAppRequest extends FormRequest
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
        $continue = $this->boolean('continue');

        return [
            'title' => ['sometimes', 'nullable', 'string', 'max:200'],
            'prompt' => $continue
                ? ['nullable', 'string', 'max:8000']
                : ['required', 'string', 'min:5', 'max:8000'],
            'app_type' => ['required', Rule::in(AppType::aiStreamableValues())],
            'tier' => ['sometimes', Rule::in(AppTier::values())],
            'model_id' => ['required', Rule::in($this->allowedCreateAppModelIds())],
            'current_html' => ['sometimes', 'nullable', 'string', 'max:524288'],
            'generation_mode' => ['sometimes', 'nullable', Rule::in(['generate', 'append', 'patch'])],
            'session_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'continue' => ['sometimes', 'boolean'],
            'generated_app_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'lease_token' => ['sometimes', 'nullable', 'string', 'max:64'],
            'queue_ticket' => ['sometimes', 'nullable', 'string', 'max:64'],
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
