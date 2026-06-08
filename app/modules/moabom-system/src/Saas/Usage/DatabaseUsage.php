<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas\Usage;

final readonly class DatabaseUsage
{
    /**
     * @param  array<string, mixed>  $extra
     */
    public function __construct(
        public string $name,
        public int $sizeBytes,
        public string $sizeHuman,
        public int $tableCount,
        public int $runtimeEstimateBytes,
        public string $runtimeEstimateHuman,
        public array $extra = [],
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return array_merge([
            'name' => $this->name,
            'size_bytes' => $this->sizeBytes,
            'size_human' => $this->sizeHuman,
            'table_count' => $this->tableCount,
            'runtime_estimate_bytes' => $this->runtimeEstimateBytes,
            'runtime_estimate_human' => $this->runtimeEstimateHuman,
        ], $this->extra);
    }
}
