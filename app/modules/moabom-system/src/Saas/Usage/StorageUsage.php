<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas\Usage;

final readonly class StorageUsage
{
    /**
     * @param  array<string, array{bytes: int, object_count: int, human?: string}>  $byDisk
     */
    public function __construct(
        public string $prefix,
        public int $totalBytes,
        public string $totalHuman,
        public array $byDisk,
        public int $provisionSeedBytes,
        public string $provisionSeedHuman,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $byDisk = [];
        foreach ($this->byDisk as $disk => $stats) {
            $byDisk[$disk] = [
                'bytes' => $stats['bytes'],
                'object_count' => $stats['object_count'],
                'human' => $stats['human'] ?? \Modules\Moabom\System\Support\FormatBytes::human($stats['bytes']),
            ];
        }

        return [
            'prefix' => $this->prefix,
            'total_bytes' => $this->totalBytes,
            'total_human' => $this->totalHuman,
            'by_disk' => $byDisk,
            'provision_seed_bytes' => $this->provisionSeedBytes,
            'provision_seed_human' => $this->provisionSeedHuman,
        ];
    }
}
