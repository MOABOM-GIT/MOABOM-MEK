<?php

declare(strict_types=1);

namespace Plugins\Sirsoft\Marketing\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class UpdateNotificationConsentRequest extends FormRequest
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
            'enabled' => ['required', 'boolean'],
        ];
    }
}
