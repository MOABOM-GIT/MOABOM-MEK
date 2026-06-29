<?php

namespace Modules\Moabom\System\Http\Requests\Platform;

use Illuminate\Foundation\Http\FormRequest;
use Modules\Moabom\System\Rules\SaasSlugAvailableRule;
use Modules\Moabom\System\Saas\SaasSlugAvailabilityService;

class StoreSaasHospitalRequest extends FormRequest
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
            'slug' => [
                'required',
                'string',
                'regex:/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/',
                new SaasSlugAvailableRule($this->container->make(SaasSlugAvailabilityService::class)),
            ],
            'name' => ['required', 'string', 'max:200'],
            'region' => ['nullable', 'string', 'max:100'],
            'note' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:500'],
            'package' => ['nullable', 'string', 'max:64'],
            'legacy_clone' => ['sometimes', 'boolean'],
            'skip_clone' => ['sometimes', 'boolean'],
            'force' => ['sometimes', 'boolean'],
            'logo_light' => ['nullable', 'file', 'max:10240', 'mimes:jpg,jpeg,png,gif,webp,svg'],
            'logo_dark' => ['nullable', 'file', 'max:10240', 'mimes:jpg,jpeg,png,gif,webp,svg'],
        ];
    }
}
