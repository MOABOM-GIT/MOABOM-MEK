<?php

namespace Modules\Moabom\Consulting\Tests\Unit;

use Modules\Moabom\Consulting\Tests\ModuleTestCase;

class SimulationModelSnapshotTest extends ModuleTestCase
{
    public function test_config_matches_simulation_model_json_ssot(): void
    {
        $path = dirname(__DIR__, 2).'/resources/simulation-model.json';
        $snapshot = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        $config = (array) config('moabom-consulting.simulation', []);

        $this->assertSame($snapshot, $config);
    }
}
