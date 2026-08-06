<?php

namespace Modules\Moabom\Smart\Chat\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StreamMessageRequest extends FormRequest
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
        $allowed = (array) config('moabom-smart-chat.allowed_model_ids', ['gemini-flash-lite']);

        return [
            'content' => ['nullable', 'string', 'max:32000'],
            'model_id' => ['nullable', 'string', Rule::in($allowed)],
            'attachment_uuids' => ['nullable', 'array', 'max:4'],
            'attachment_uuids.*' => ['uuid'],
            'parent_id' => ['nullable', 'integer', 'min:1'],
            'generated_app_id' => ['nullable', 'integer', 'min:1'],
            'tools' => ['nullable', 'array', 'max:8'],
            'tools.*' => ['string', Rule::in(\Modules\Moabom\Smart\Chat\Services\SmartChatSiteToolService::ALL_TOOLS)],
            'web_search' => ['nullable', 'boolean'],
        ];
    }
}
