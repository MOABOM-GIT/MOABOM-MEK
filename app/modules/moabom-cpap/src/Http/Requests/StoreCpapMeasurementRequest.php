<?php

namespace Modules\Moabom\Cpap\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCpapMeasurementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * 요청에 적용할 검증 규칙입니다.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'profile' => ['required', 'array'],
            'profile.gender' => ['required', Rule::in(['male', 'female'])],
            'profile.ageGroup' => ['required', Rule::in(['20s', '30s', '40s', '50s', '60s+'])],
            'profile.tossing' => ['required', Rule::in(['low', 'medium', 'high'])],
            'profile.mouthBreathing' => ['required', 'boolean'],
            'profile.pressure' => ['required', Rule::in(['low', 'medium', 'high'])],
            'profile.preferredTypes' => ['sometimes', 'array', 'max:5'],
            'profile.preferredTypes.*' => ['string', 'max:60'],
            'measurements' => ['required', 'array'],
            'measurements.*' => ['numeric'],
            'profile_measurements' => ['nullable', 'array'],
            'profile_measurements.*' => ['numeric'],
            'recommendation' => ['required', 'array'],
            'recommendation.type' => ['nullable', 'string', 'max:60'],
            'recommendation.name' => ['nullable', 'string', 'max:120'],
            'recommendation.confidence' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'metadata' => ['sometimes', 'array'],
        ];
    }
}
