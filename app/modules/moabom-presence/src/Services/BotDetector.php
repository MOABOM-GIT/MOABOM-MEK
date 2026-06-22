<?php

namespace Modules\Moabom\Presence\Services;

use Illuminate\Http\Request;
use Jaybizzle\CrawlerDetect\CrawlerDetect;

/**
 * G7 SEO 봇 감지(jaybizzle/crawler-detect)를 재사용해 heartbeat 대상에서 제외합니다.
 */
final class BotDetector
{
    public function isBot(Request $request): bool
    {
        $userAgent = (string) $request->userAgent();
        if ($userAgent === '') {
            return true;
        }

        return (new CrawlerDetect)->isCrawler($userAgent);
    }
}
