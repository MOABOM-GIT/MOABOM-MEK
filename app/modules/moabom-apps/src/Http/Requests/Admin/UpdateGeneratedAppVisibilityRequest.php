<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\Moabom\Apps\Enums\GeneratedAppVisibility;

class UpdateGeneratedAppVisibilityRequest extends FormRequest
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
            'visibility' => [
                'required',
                'string',
                Rule::in(GeneratedAppVisibility::values()),
            ],
        ];
    }

    public function visibility(): GeneratedAppVisibility
    {
        return GeneratedAppVisibility::from((string) $this->validated('visibility'));
    }
}
