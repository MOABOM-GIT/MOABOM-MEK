<?php

declare(strict_types=1);

namespace Plugins\Moabom\Fcm\DTO;

final readonly class FcmSendResult
{
    public function __construct(
        public bool $success,
        public ?string $messageId = null,
        public ?string $error = null,
    ) {}

    public static function disabled(string $reason = 'disabled'): self
    {
        return new self(false, null, $reason);
    }

    public static function ok(string $messageId): self
    {
        return new self(true, $messageId, null);
    }

    public static function failed(string $error): self
    {
        return new self(false, null, $error);
    }
}
