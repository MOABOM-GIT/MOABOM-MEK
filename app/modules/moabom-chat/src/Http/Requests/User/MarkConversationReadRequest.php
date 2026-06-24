<?php

namespace Modules\Moabom\Chat\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;

final class MarkConversationReadRequest extends FormRequest
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
            'message_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
        ];
    }
}
