<?php

namespace Modules\Moabom\Apps\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ShareGeneratedAppRequest extends FormRequest
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
            'is_shared' => ['required', 'boolean'],
        ];
    }
}
