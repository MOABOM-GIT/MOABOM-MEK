<?php

namespace Modules\Moabom\Presence\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;

class FriendActionRequest extends FormRequest
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
        ];
    }
}
