<?php

namespace Modules\Moabom\Presence\Http\Requests\Public;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\Moabom\Presence\Enums\PresenceClientFormFactor;

final class PresenceHeartbeatRequest extends FormRequest
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
            'status_text' => ['nullable', 'string', 'max:255'],
            'client_form_factor' => ['nullable', 'string', Rule::in(array_column(PresenceClientFormFactor::cases(), 'value'))],
            'touch' => ['nullable', 'string', Rule::in(['login', 'logout', 'touch'])],
            'ws_state' => ['nullable', 'string', Rule::in(['connected', 'disconnected'])],
            'visibility_state' => ['nullable', 'string', Rule::in(['visible', 'hidden'])],
        ];
    }
}
