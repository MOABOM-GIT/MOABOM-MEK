<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas\Deprovision;

final readonly class PurgeResult
{
    /**
     * @param  array<string, mixed>  $metrics
     */
    public function __construct(
        public string $slug,
        public string $mode,
        public int $operationId,
        public array $metrics = [],
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'slug' => $this->slug,
            'mode' => $this->mode,
            'operation_id' => $this->operationId,
            'metrics' => $this->metrics,
        ];
    }
}
