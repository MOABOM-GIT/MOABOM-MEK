<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Modules\Moabom\System\Saas\SaasSlugAvailabilityService;

/**
 * SaaS 업체 slug — 예상 호스트 사용 가능 여부 검증.
 */
final class SaasSlugAvailableRule implements ValidationRule
{
    public function __construct(
        private readonly SaasSlugAvailabilityService $availability,
    ) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $result = $this->availability->check((string) $value);
        if ($result['available']) {
            return;
        }

        $fail(__('moabom-system::messages.saas.hospitals.slug_unavailable'));
    }
}
