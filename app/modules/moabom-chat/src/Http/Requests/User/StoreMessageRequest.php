<?php

namespace Modules\Moabom\Chat\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;

final class StoreMessageRequest extends FormRequest
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
            'body' => ['required', 'string', 'min:1', 'max:4000'],
            'client_message_id' => ['required', 'uuid'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('body')) {
            $this->merge(['body' => trim((string) $this->input('body'))]);
        }
    }
}
