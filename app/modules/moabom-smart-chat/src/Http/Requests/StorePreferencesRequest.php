<?php

namespace Modules\Moabom\Smart\Chat\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePreferencesRequest extends FormRequest
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
        $max = (int) config('moabom-smart-chat.preferences.max_instructions_chars', 4000);

        return [
            'custom_instructions' => ['nullable', 'string', 'max:'.$max],
            'enabled_tools' => ['nullable', 'array', 'max:8'],
            'enabled_tools.*' => ['string', Rule::in(\Modules\Moabom\Smart\Chat\Services\SmartChatSiteToolService::ALL_TOOLS)],
            'web_search_enabled' => ['nullable', 'boolean'],
        ];
    }
}
