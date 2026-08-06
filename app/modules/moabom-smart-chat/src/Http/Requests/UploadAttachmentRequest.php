<?php

namespace Modules\Moabom\Smart\Chat\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UploadAttachmentRequest extends FormRequest
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
        $maxKb = (int) ceil(((int) config('moabom-smart-chat.attachments.max_image_bytes', 10 * 1024 * 1024)) / 1024);

        return [
            'file' => ['required', 'file', 'max:'.$maxKb],
            'conversation_uuid' => ['nullable', 'uuid'],
        ];
    }
}
