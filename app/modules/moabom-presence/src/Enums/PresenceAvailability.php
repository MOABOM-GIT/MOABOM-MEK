<?php

namespace Modules\Moabom\Presence\Enums;

enum PresenceAvailability: string
{
    case Online = 'online';
    case Away = 'away';
    case Busy = 'busy';
    case Offline = 'offline';

    public static function tryFromString(?string $value): self
    {
        return self::tryFrom((string) $value) ?? self::Online;
    }
}
