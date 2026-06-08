<?php

namespace Modules\Moabom\Cpap\Enums;

/**
 * CPAP 추천 마스크 유형 Enum.
 *
 * 표시명(displayName)은 프론트엔드 recommendMask
 * (templates/moabom-basic/src/apps/cpap-mask/cpapMeasurement.ts)와 1:1 일치해야 하므로
 * 의도적으로 i18n(`__()`) 하지 않는다. 번역 시 서버 재계산 결과와 화면 표시값이
 * 달라져 "무손상" 보장이 깨진다.
 */
enum MaskType: string
{
    /** 나잘 마스크 */
    case Nasal = 'nasal';

    /** 나잘 필로우 마스크 */
    case NasalPillow = 'nasal-pillow';

    /** 풀페이스 마스크 */
    case FullFace = 'full-face';

    /**
     * 내부 스코어링 키('nasal'|'pillow'|'full')를 표준 마스크 유형으로 변환합니다.
     */
    public static function fromScoreKey(string $key): self
    {
        return match ($key) {
            'full' => self::FullFace,
            'pillow' => self::NasalPillow,
            default => self::Nasal,
        };
    }

    /**
     * 프론트엔드와 1:1 일치하는 표시명(의도적 비 i18n).
     */
    public function displayName(): string
    {
        return match ($this) {
            self::FullFace => '풀페이스 마스크',
            self::NasalPillow => '나잘 필로우 마스크',
            self::Nasal => '나잘 마스크',
        };
    }
}
