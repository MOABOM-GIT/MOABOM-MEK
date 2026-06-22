<?php

namespace Modules\Moabom\Presence\Enums;

enum PresenceSubtitleMode: string
{
    case ProfileBio = 'profile_bio';
    case Activity = 'activity';
    case Hidden = 'hidden';

    public static function tryFromString(?string $value): self
    {
        return self::tryFrom((string) $value) ?? self::ProfileBio;
    }
}
