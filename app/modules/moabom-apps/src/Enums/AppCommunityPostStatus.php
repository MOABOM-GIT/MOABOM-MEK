<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Enums;

enum AppCommunityPostStatus: string
{
    case Published = 'published';
    case Hidden = 'hidden';
    case Deleted = 'deleted';

    public function isPubliclyVisible(): bool
    {
        return $this === self::Published;
    }
}
