<?php

namespace Modules\Moabom\Chat\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;

final class StoreBlockRequest extends FormRequest
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
            'user_uuid' => ['required', 'uuid'],
            'reason' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }
}
