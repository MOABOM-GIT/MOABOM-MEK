<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas\Deprovision;

final readonly class DestroyOptions
{
    public function __construct(
        public string $confirmSlug,
        public string $confirmHost,
        public ?int $operationId = null,
        public ?int $actorUserId = null,
    ) {}
}
