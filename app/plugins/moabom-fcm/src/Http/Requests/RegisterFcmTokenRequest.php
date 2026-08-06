<?php

declare(strict_types=1);

namespace Plugins\Moabom\Fcm\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Plugins\Moabom\Fcm\Enums\FcmPlatform;

final class RegisterFcmTokenRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'token' => ['required', 'string', 'min:32', 'max:512'],
            'platform' => ['sometimes', 'string', Rule::in(FcmPlatform::values())],
            'device_label' => ['sometimes', 'nullable', 'string', 'max:120'],
        ];
    }
}
