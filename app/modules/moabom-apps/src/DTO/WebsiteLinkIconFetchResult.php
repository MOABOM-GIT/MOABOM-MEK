<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\DTO;

/**
 * 웹사이트 파비콘 추출·다운로드 결과.
 */
final class WebsiteLinkIconFetchResult
{
    /**
     * @param  array{content: string, mime: string, ext: string}  $binary
     */
    public function __construct(
        public readonly string $sourceUrl,
        public readonly array $binary,
    ) {
    }
}
