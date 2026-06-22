<?php

declare(strict_types=1);

namespace Modules\Moabom\Cpap\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class CpapMeasurementListRequest extends FormRequest
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
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'q' => ['sometimes', 'nullable', 'string', 'max:120'],
        ];
    }
}
