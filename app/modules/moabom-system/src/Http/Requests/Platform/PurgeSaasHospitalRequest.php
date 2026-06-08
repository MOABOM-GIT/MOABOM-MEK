<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Http\Requests\Platform;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PurgeSaasHospitalRequest extends FormRequest
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
            'mode' => ['required', 'string', Rule::in(['db_data', 'storage_data'])],
            'confirm_slug' => ['required', 'string', 'max:63'],
        ];
    }
}
