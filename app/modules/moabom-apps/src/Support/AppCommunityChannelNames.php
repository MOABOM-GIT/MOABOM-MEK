<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Support;

/**
 * 앱 이야기 Reverb public 채널 SSOT.
 *
 * 앱별 단일 revision 채널 — presence.revision 패턴과 동일하게
 * 목록·집계 stale 방지용 bump 신호만 전달 (페이로드 최소화).
 */
final class AppCommunityChannelNames
{
    public static function revisionChannel(int $generatedAppId): string
    {
        return 'moabom-app-community.'.$generatedAppId;
    }

    public static function revisionCacheKey(int $generatedAppId): string
    {
        return 'moabom-app-community:revision:'.$generatedAppId;
    }
}
