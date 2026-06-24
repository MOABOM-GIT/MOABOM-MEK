<?php

namespace Modules\Moabom\Chat\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;

final class StartConversationRequest extends FormRequest
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
            'member_uuids' => ['required', 'array', 'min:1', 'max:30'],
            'member_uuids.*' => ['required', 'uuid', 'distinct'],
            'title' => ['sometimes', 'nullable', 'string', 'max:120'],
        ];
    }
}
