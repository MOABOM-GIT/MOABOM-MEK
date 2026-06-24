<?php

namespace Modules\Moabom\Cpap\Tests\Unit;

use Modules\Moabom\Cpap\Services\CpapRecommendEngine;
use Modules\Moabom\Cpap\Tests\ModuleTestCase;

class RecommendParityFixturesTest extends ModuleTestCase
{
    public function test_recommend_matches_shared_parity_fixtures(): void
    {
        $path = dirname(__DIR__, 2).'/resources/recommend-parity-fixtures.json';
        $fixtures = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        $engine = $this->app->make(CpapRecommendEngine::class);

        foreach ($fixtures as $fixture) {
            $result = $engine->recommend(
                (array) ($fixture['profile'] ?? []),
                (array) ($fixture['measurements'] ?? []),
                (array) ($fixture['profile_measurements'] ?? []),
            );
            $expected = (array) ($fixture['expected'] ?? []);
            $id = (string) ($fixture['id'] ?? 'unknown');

            if (isset($expected['type'])) {
                $this->assertSame($expected['type'], $result['type'], "fixture {$id}: type");
            }
            if (isset($expected['name'])) {
                $this->assertSame($expected['name'], $result['name'], "fixture {$id}: name");
            }
            if (isset($expected['confidence'])) {
                $this->assertSame((int) $expected['confidence'], $result['confidence'], "fixture {$id}: confidence");
            }
            if (isset($expected['reasons_contains'])) {
                foreach ((array) $expected['reasons_contains'] as $reason) {
                    $this->assertContains($reason, $result['reasons'], "fixture {$id}: reasons");
                }
            }
        }
    }
}
