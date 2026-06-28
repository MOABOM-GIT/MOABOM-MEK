<?php

namespace Modules\Moabom\Apps\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\Moabom\Apps\Enums\GeneratedAppVisibility;

class ShareGeneratedAppRequest extends FormRequest
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
            // global 은 admin plane 전용 (§9.5). 회원은 업체 등록(tenant)·비공개만.
            'visibility' => ['sometimes', Rule::in([
                GeneratedAppVisibility::Private->value,
                GeneratedAppVisibility::Tenant->value,
            ])],
            'is_shared' => ['sometimes', 'boolean'],
        ];
    }
}
