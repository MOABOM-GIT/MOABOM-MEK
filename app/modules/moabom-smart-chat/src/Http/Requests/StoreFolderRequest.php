<?php

namespace Modules\Moabom\Smart\Chat\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreFolderRequest extends FormRequest
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
        $max = (int) config('moabom-smart-chat.folders.max_name_chars', 80);

        return [
            'name' => ['required', 'string', 'max:'.$max],
        ];
    }
}
