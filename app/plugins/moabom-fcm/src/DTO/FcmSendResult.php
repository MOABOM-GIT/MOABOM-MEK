<?php

declare(strict_types=1);

namespace Plugins\Moabom\Fcm\DTO;

final readonly class FcmSendResult
{
    /**
     * @param  list<string>  $invalidTokens
     */
    public function __construct(
        public bool $success,
        public ?string $messageId = null,
        public ?string $error = null,
        public array $invalidTokens = [],
        public int $sentCount = 0,
        public int $failedCount = 0,
    ) {}

    public static function disabled(string $reason = 'disabled'): self
    {
        return new self(false, null, $reason);
    }

    public static function ok(string $messageId, int $sentCount = 1): self
    {
        return new self(true, $messageId, null, [], $sentCount, 0);
    }

    public static function failed(string $error, array $invalidTokens = [], int $failedCount = 1): self
    {
        return new self(false, null, $error, $invalidTokens, 0, $failedCount);
    }

    /**
     * @param  list<string>  $invalidTokens
     */
    public static function partial(int $sentCount, int $failedCount, array $invalidTokens = [], ?string $messageId = null): self
    {
        return new self(
            $sentCount > 0,
            $messageId,
            $failedCount > 0 ? 'partial_failure' : null,
            $invalidTokens,
            $sentCount,
            $failedCount,
        );
    }
}
