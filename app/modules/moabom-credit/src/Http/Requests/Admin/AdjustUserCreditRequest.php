<?php

declare(strict_types=1);

namespace Modules\Moabom\Credit\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AdjustUserCreditRequest extends FormRequest
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
            'direction' => ['required', 'string', Rule::in(['increase', 'decrease'])],
            'amount' => ['required', 'integer', 'min:1', 'max:1000000'],
            'description' => ['nullable', 'string', 'max:500'],
        ];
    }
}
