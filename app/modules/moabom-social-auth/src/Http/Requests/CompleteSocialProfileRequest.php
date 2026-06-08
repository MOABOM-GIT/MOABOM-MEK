<?php

namespace Modules\Moabom\Social\Auth\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;
use Modules\Moabom\Social\Auth\Repositories\Contracts\SocialAuthCodeRepositoryInterface;

class CompleteSocialProfileRequest extends FormRequest
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
            'email' => 'nullable|email|max:255',
            'name' => 'nullable|string|max:255',
            'nickname' => 'nullable|string|max:50',
            'mobile' => 'nullable|string|max:20',
        ];
    }

    /**
     * 추가 검증을 구성합니다.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $email = trim((string) $this->input('email', ''));
            if ($email === '') {
                return;
            }

            $authCode = app(SocialAuthCodeRepositoryInterface::class)
                ->findUsableByPlainCode((string) $this->input('code'));

            $exists = User::where('email', $email)
                ->when($authCode, fn ($query) => $query->whereKeyNot($authCode->user_id))
                ->exists();

            if ($exists) {
                $validator->errors()->add('email', __('validation.unique', ['attribute' => __('validation.attributes.email')]));
            }
        });
    }
}
