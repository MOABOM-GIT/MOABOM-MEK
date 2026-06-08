<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Branding;

/**
 * G7 core site_logo 컬렉션 + 라이트/다크 슬롯 규약 (moabom-system).
 */
final class SiteLogoIdentifiers
{
    public const COLLECTION = 'site_logo';

    public const VARIANT_LIGHT = 'light';

    public const VARIANT_DARK = 'dark';

    public const SOURCE_LIGHT = 'site_logo:light';

    public const SOURCE_DARK = 'site_logo:dark';

    /** 로고 업로드 전용 accept (전역 upload.allowed_extensions 와 분리). */
    public const ACCEPT_FORMATTED = '.jpg,.jpeg,.png,.gif,.webp,.svg';

    public const FALLBACK_LIGHT_URL = '/api/templates/assets/moabom-basic/img/logo_smartcare.svg';

    public const FALLBACK_DARK_URL = '/api/templates/assets/moabom-basic/img/logo_smartcare_w.svg';

    public static function sourceIdentifierForVariant(string $variant): ?string
    {
        return match ($variant) {
            self::VARIANT_LIGHT => self::SOURCE_LIGHT,
            self::VARIANT_DARK => self::SOURCE_DARK,
            default => null,
        };
    }

    public static function variantFromSourceIdentifier(?string $sourceIdentifier): ?string
    {
        return match ($sourceIdentifier) {
            self::SOURCE_LIGHT => self::VARIANT_LIGHT,
            self::SOURCE_DARK => self::VARIANT_DARK,
            default => null,
        };
    }

    public static function orderForVariant(string $variant): int
    {
        return match ($variant) {
            self::VARIANT_LIGHT => 1,
            self::VARIANT_DARK => 2,
            default => 99,
        };
    }
}
