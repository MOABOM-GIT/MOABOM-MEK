<?php

namespace Modules\Moabom\Smart\Chat\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreConversationRequest extends FormRequest
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
        $allowed = (array) config('moabom-smart-chat.allowed_model_ids', ['gemini-flash-lite']);

        return [
            'model_id' => ['nullable', 'string', Rule::in($allowed)],
            'folder_uuid' => ['nullable', 'uuid'],
        ];
    }
}
