<?php

namespace Modules\Moabom\Apps\Support;

final readonly class GeneratedAppHtmlSecurityScanResult
{
    /**
     * @param  array<int, GeneratedAppHtmlSecurityViolation>  $violations
     */
    public function __construct(
        public array $violations,
    ) {}

    public function isClean(): bool
    {
        return $this->violations === [];
    }

    /**
     * @return array<int, string>
     */
    public function ruleIds(): array
    {
        return array_values(array_unique(array_map(
            static fn (GeneratedAppHtmlSecurityViolation $violation): string => $violation->ruleId,
            $this->violations,
        )));
    }
}
