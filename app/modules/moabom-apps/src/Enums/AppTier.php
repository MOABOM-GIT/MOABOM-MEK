<?php

namespace Modules\Moabom\Apps\Enums;

/**
 * AI 생성 앱 호스팅 티어.
 *
 * @see docs/GENERATED-APP-TIERS.md
 */
enum AppTier: string
{
    /** cross-origin 프리뷰 (apps.mek360.com/g/{id}) — HTML만 */
    case Standard = 'standard';

    /** 앱별 Host ({id}.apps.mek360.com) — HTML + row·GCS */
    case Hosted = 'hosted';

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(static fn (self $case): string => $case->value, self::cases());
    }

    public function isHosted(): bool
    {
        return $this === self::Hosted;
    }
}
