<?php

namespace Modules\Moabom\Cpap\Tests\Unit;

use Modules\Moabom\Cpap\Enums\MaskType;
use Modules\Moabom\Cpap\Tests\ModuleTestCase;

class RecommendRulesSnapshotTest extends ModuleTestCase
{
    public function test_config_matches_recommend_rules_json_ssot(): void
    {
        $path = dirname(__DIR__, 2).'/resources/recommend-rules.json';
        $snapshot = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        $config = (array) config('moabom-cpap.recommend_rules', []);

        $this->assertSame($snapshot, $config);
    }

    public function test_mask_type_display_names_match_rules_json(): void
    {
        $rules = (array) config('moabom-cpap.recommend_rules', []);
        $maskTypes = (array) ($rules['mask_types'] ?? []);

        $this->assertSame($maskTypes['nasal']['display_name'], MaskType::Nasal->displayName());
        $this->assertSame($maskTypes['pillow']['display_name'], MaskType::NasalPillow->displayName());
        $this->assertSame($maskTypes['full']['display_name'], MaskType::FullFace->displayName());
    }
}
