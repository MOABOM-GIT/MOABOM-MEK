<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Http\Requests\Platform;

use Illuminate\Foundation\Http\FormRequest;

class DestroySaasHospitalRequest extends FormRequest
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
            'confirm_slug' => ['required', 'string', 'max:63'],
            'confirm_host' => ['required', 'string', 'max:255'],
        ];
    }
}
