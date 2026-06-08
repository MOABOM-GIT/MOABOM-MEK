<?php

namespace Modules\Moabom\Social\Auth\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ExchangeSocialAuthCodeRequest extends FormRequest
{
    /**
     * 요청 권한을 확인합니다.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * 검증 규칙을 반환합니다.
     *
     * @return array<string, string>
     */
    public function rules(): array
    {
        return [
            'code' => 'required|string|min:32|max:128',
        ];
    }

    /**
     * 검증 메시지를 반환합니다.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'code.required' => __('moabom-social-auth::messages.code_required'),
        ];
    }
}
