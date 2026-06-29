<?php

declare(strict_types=1);

namespace Plugins\Moabom\Fcm\DTO;

/**
 * @phpstan-type FcmData array<string, string>
 */
final readonly class FcmMessage
{
    /**
     * @param  list<string>  $deviceTokens
     * @param  array<string, string>  $data
     */
    public function __construct(
        public array $deviceTokens,
        public ?string $title = null,
        public ?string $body = null,
        public array $data = [],
    ) {}

    public function primaryToken(): ?string
    {
        return $this->deviceTokens[0] ?? null;
    }
}
