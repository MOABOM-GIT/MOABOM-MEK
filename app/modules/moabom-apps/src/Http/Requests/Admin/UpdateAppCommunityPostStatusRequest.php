<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\Moabom\Apps\Enums\AppCommunityHiddenReason;
use Modules\Moabom\Apps\Enums\AppCommunityPostStatus;

class UpdateAppCommunityPostStatusRequest extends FormRequest
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
            'status' => ['required', 'string', Rule::in([
                AppCommunityPostStatus::Published->value,
                AppCommunityPostStatus::Hidden->value,
                AppCommunityPostStatus::Deleted->value,
            ])],
            'hidden_reason' => ['nullable', 'string', Rule::in([
                AppCommunityHiddenReason::Admin->value,
                AppCommunityHiddenReason::Owner->value,
                AppCommunityHiddenReason::Report->value,
            ])],
        ];
    }

    public function status(): AppCommunityPostStatus
    {
        return AppCommunityPostStatus::from((string) $this->validated('status'));
    }

    public function hiddenReason(): ?AppCommunityHiddenReason
    {
        $raw = $this->validated('hidden_reason');

        return is_string($raw) && $raw !== ''
            ? AppCommunityHiddenReason::from($raw)
            : null;
    }
}
