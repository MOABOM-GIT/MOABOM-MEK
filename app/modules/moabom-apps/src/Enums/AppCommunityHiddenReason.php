<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Enums;

enum AppCommunityHiddenReason: string
{
    case Admin = 'admin';
    case Owner = 'owner';
    case Report = 'report';
}
