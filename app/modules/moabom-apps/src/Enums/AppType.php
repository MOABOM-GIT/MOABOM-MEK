<?php

namespace Modules\Moabom\Apps\Enums;

/**
 * AI 생성 앱 유형 Enum.
 *
 * 허용 값은 프론트엔드 및 시스템 프롬프트 키와 1:1 대응한다.
 */
enum AppType: string
{
    /** 일반 웹앱 */
    case General = 'general';

    /** 사용자가 HTML 소스를 직접 붙여넣음 (AI 생성 없음) */
    case HtmlPaste = 'html_paste';

    /** Three.js 3D 캔버스 */
    case ThreeD = '3d';

    /** Phaser 3 인터랙션 캔버스 */
    case Game = 'game';

    /** Chart.js 데이터 시각화 */
    case DataViz = 'dataviz';

    /** 외부 웹사이트 iframe 연결 */
    case WebsiteLink = 'website_link';

    /**
     * 허용되는 앱 유형 값 목록을 반환합니다(검증 규칙용).
     *
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(static fn (self $case): string => $case->value, self::cases());
    }

    /**
     * AI 스트림/생성 API에 허용되는 유형 (직접 입력·웹사이트 연결 제외).
     *
     * @return list<string>
     */
    public static function aiGeneratableValues(): array
    {
        return array_values(array_filter(
            self::values(),
            static fn (string $value): bool => ! in_array($value, [
                self::HtmlPaste->value,
                self::WebsiteLink->value,
            ], true)
        ));
    }
}
