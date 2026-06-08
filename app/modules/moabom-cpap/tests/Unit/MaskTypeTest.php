<?php

namespace Modules\Moabom\Cpap\Tests\Unit;

use Modules\Moabom\Cpap\Enums\MaskType;
use Modules\Moabom\Cpap\Tests\ModuleTestCase;

class MaskTypeTest extends ModuleTestCase
{
    /**
     * 내부 스코어링 키가 표준 마스크 유형 값으로 정확히 매핑된다(프론트엔드 1:1 보존).
     */
    public function test_from_score_key_maps_to_canonical_values(): void
    {
        $this->assertSame('full-face', MaskType::fromScoreKey('full')->value);
        $this->assertSame('nasal-pillow', MaskType::fromScoreKey('pillow')->value);
        $this->assertSame('nasal', MaskType::fromScoreKey('nasal')->value);
        // 알 수 없는 키는 nasal 로 폴백.
        $this->assertSame('nasal', MaskType::fromScoreKey('unknown')->value);
    }

    /**
     * 표시명이 프론트엔드 recommendMask 와 동일해야 한다.
     */
    public function test_display_names_match_frontend(): void
    {
        $this->assertSame('풀페이스 마스크', MaskType::FullFace->displayName());
        $this->assertSame('나잘 필로우 마스크', MaskType::NasalPillow->displayName());
        $this->assertSame('나잘 마스크', MaskType::Nasal->displayName());
    }
}
