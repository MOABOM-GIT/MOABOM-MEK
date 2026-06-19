<?php

namespace Modules\Moabom\Apps\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\Moabom\Apps\Enums\AppType;

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
            'model_id' => ['nullable', Rule::in(['claude-sonnet', 'gpt-chat-latest', 'gpt-4o', 'gemini-flash-lite'])],
            'prompt' => ['nullable', 'string', 'max:8000'],
            'html' => ['required', 'string', 'min:20', 'max:524288'],
            'is_shared' => ['sometimes', 'boolean'],
            'parent_app_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'version' => ['sometimes', 'integer', 'min:1'],
            'metadata' => ['sometimes', 'array'],
        ];
    }
}
