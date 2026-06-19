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
            'app_type' => ['required', Rule::in(AppType::values())],
            'model_id' => ['required', Rule::in(['claude-sonnet', 'gpt-chat-latest', 'gpt-4o', 'gemini-flash-lite'])],
            'current_html' => ['sometimes', 'nullable', 'string', 'max:524288'],
        ];
    }
}
