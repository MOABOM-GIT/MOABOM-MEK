<?php

namespace Modules\Moabom\Presence\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\Moabom\Presence\Enums\PresenceAvailability;
use Modules\Moabom\Presence\Enums\PresenceSubtitleMode;

final class UpdatePresenceSettingsRequest extends FormRequest
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
            'availability' => ['sometimes', 'string', Rule::enum(PresenceAvailability::class)],
            'subtitle_mode' => ['sometimes', 'string', Rule::enum(PresenceSubtitleMode::class)],
            'activity_message' => ['sometimes', 'nullable', 'string', 'max:255'],
            'show_avatar_in_connect_list' => ['sometimes', 'boolean'],
            'accept_chat_requests' => ['sometimes', 'boolean'],
        ];
    }
}
