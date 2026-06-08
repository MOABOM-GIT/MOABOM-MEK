<?php

namespace Modules\Moabom\System\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Modules\Moabom\System\Services\HomeBackgroundService;

class UploadHomeBackgroundRequest extends FormRequest
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
        $maxKb = 12 * 1024;
        $mimes = array_map(
            static fn (string $mime) => match ($mime) {
                'image/jpeg' => 'jpg,jpeg',
                'image/png' => 'png',
                'image/webp' => 'webp',
                default => null,
            },
            HomeBackgroundService::allowedMimeTypes(),
        );
        $mimesRule = implode(',', array_filter($mimes));

        return [
            'file' => ['required', 'file', 'mimes:'.$mimesRule, 'max:'.$maxKb],
        ];
    }
}
