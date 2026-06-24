<?php

namespace Modules\Moabom\Chat\Enums;

enum ChatMemberRole: string
{
    case Owner = 'owner';
    case Member = 'member';
}
