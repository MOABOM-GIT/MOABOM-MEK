<?php

namespace Modules\Moabom\Apps\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Modules\Moabom\Apps\Support\GeneratedAppHtmlSecurityScanner;

class GeneratedAppHtmlSecurityRule implements ValidationRule
{
    public function __construct(
        private readonly GeneratedAppHtmlSecurityScanner $scanner = new GeneratedAppHtmlSecurityScanner,
    ) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $result = $this->scanner->scan((string) $value);
        if ($result->isClean()) {
            return;
        }

        foreach ($result->ruleIds() as $ruleId) {
            $fail(__('moabom-apps::messages.apps.generated.security.'.$ruleId));
        }
    }
}
