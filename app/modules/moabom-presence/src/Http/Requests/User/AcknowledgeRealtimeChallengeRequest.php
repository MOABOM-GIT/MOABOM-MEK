<?php

declare(strict_types=1);

namespace Modules\Moabom\Presence\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;

final class AcknowledgeRealtimeChallengeRequest extends FormRequest
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
            'token' => ['required', 'string', 'max:4096'],
        ];
    }
}
