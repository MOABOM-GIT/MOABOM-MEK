<?php

namespace Modules\Moabom\Consulting\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreContractRequest extends FormRequest
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
            'hospital_name' => ['required', 'string', 'max:200'],
            'representative_name' => ['nullable', 'string', 'max:120'],
            'contact' => ['nullable', 'string', 'max:120'],
            'business_number' => ['nullable', 'string', 'max:40'],
            'plan' => ['nullable', 'string', 'max:120'],
            'simulation_input' => ['nullable', 'array'],
            'simulation_input.initial_patients' => ['nullable', 'numeric'],
            'simulation_input.monthly_new_patients' => ['nullable', 'numeric'],
            'simulation_input.staff_count' => ['nullable', 'numeric'],
            'simulation_input.staff_salary' => ['nullable', 'numeric'],
            'simulation_input.equipment_price' => ['nullable', 'numeric'],
            'simulation_input.refurbish_cost' => ['nullable', 'numeric'],
            'simulation_input.adherence_pass_rate' => ['nullable', 'numeric'],
            'simulation_input.annual_retention' => ['nullable', 'numeric'],
            'simulation_input.years' => ['nullable', 'integer'],
            'signer_name' => ['nullable', 'string', 'max:120'],
            // 서명 이미지: data URL(base64 PNG). 과대 페이로드 방지 상한.
            'signature' => ['nullable', 'string', 'max:2000000'],
            'memo' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
