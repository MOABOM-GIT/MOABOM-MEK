<?php

namespace Modules\Moabom\Apps\Enums;

/**
 * AI 생성 앱 유형 Enum.
 *
 * 허용 값은 프론트엔드 및 시스템 프롬프트 키와 1:1 대응한다.
 */
enum AppType: string
{
    /** 일반 웹 애플리케이션 */
    case General = 'general';

    /** Three.js 3D 씬 */
    case ThreeD = '3d';

    /** Phaser 3 게임 */
    case Game = 'game';

    /** Chart.js 데이터 시각화 */
    case DataViz = 'dataviz';

    /**
     * 허용되는 앱 유형 값 목록을 반환합니다(검증 규칙용).
     *
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(static fn (self $case): string => $case->value, self::cases());
    }
}
