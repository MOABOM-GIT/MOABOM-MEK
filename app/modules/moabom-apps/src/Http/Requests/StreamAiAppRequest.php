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
            'prompt' => $continue
                ? ['nullable', 'string', 'max:8000']
                : ['required', 'string', 'min:5', 'max:8000'],
            'app_type' => ['required', Rule::in(AppType::values())],
            'tier' => ['sometimes', Rule::in(AppTier::values())],
            'model_id' => ['required', Rule::in(['claude-sonnet', 'gpt-chat-latest', 'gpt-4o', 'gemini-flash-lite'])],
            'current_html' => ['sometimes', 'nullable', 'string', 'max:524288'],
            'generation_mode' => ['sometimes', 'nullable', Rule::in(['generate', 'append', 'patch'])],
            'session_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'continue' => ['sometimes', 'boolean'],
            'generated_app_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'lease_token' => ['sometimes', 'nullable', 'string', 'max:64'],
            'queue_ticket' => ['sometimes', 'nullable', 'string', 'max:64'],
        ];
    }
}
