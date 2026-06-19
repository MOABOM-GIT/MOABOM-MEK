<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

final class SaasAdminCredentials
{
    public const DEFAULT_ADMIN_NAME = '관리자';
    public const DEFAULT_ADMIN_EMAIL = 'admin@mek360.com';
    public const DEFAULT_ADMIN_PASSWORD = 'mek360';

    public static function email(?string $email = null): string
    {
        $email = trim((string) $email);

        return $email !== '' ? $email : self::DEFAULT_ADMIN_EMAIL;
    }

    public static function password(?string $password = null): string
    {
        $password = (string) $password;

        return $password !== '' ? $password : self::DEFAULT_ADMIN_PASSWORD;
    }
}
