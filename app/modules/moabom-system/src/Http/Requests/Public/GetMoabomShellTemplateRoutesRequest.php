<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Http\Requests\Public;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * `GET .../public/template-routes-shell` 요청 검증.
 */
class GetMoabomShellTemplateRoutesRequest extends FormRequest
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
            'template' => ['required', 'string', 'max:64', 'regex:/^[a-z0-9][a-z0-9_-]*$/'],
            'scope' => ['sometimes', 'string', Rule::in(['shell', 'full'])],
        ];
    }

    public function resolvedTemplate(): string
    {
        return (string) $this->validated('template');
    }

    public function resolvedScope(): string
    {
        return (string) ($this->validated('scope') ?? 'shell');
    }
}
