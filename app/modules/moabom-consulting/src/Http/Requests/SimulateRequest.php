<?php

namespace Modules\Moabom\Consulting\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SimulateRequest extends FormRequest
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
            'initial_patients' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'monthly_new_patients' => ['nullable', 'numeric', 'min:0', 'max:10000'],
            'staff_count' => ['nullable', 'numeric', 'min:0', 'max:1000'],
            'staff_salary' => ['nullable', 'numeric', 'min:0', 'max:1000000000'],
            'equipment_price' => ['nullable', 'numeric', 'min:0', 'max:1000000000'],
            'refurbish_cost' => ['nullable', 'numeric', 'min:0', 'max:1000000000'],
            'adherence_pass_rate' => ['nullable', 'numeric', 'min:0', 'max:1'],
            'annual_retention' => ['nullable', 'numeric', 'min:0', 'max:1'],
            'years' => ['nullable', 'integer', 'min:1', 'max:12'],
        ];
    }
}
