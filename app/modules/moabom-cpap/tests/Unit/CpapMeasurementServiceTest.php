<?php

namespace Modules\Moabom\Cpap\Tests\Unit;

use App\Models\User;
use Modules\Moabom\Cpap\Services\CpapMeasurementService;
use Modules\Moabom\Cpap\Tests\ModuleTestCase;

class CpapMeasurementServiceTest extends ModuleTestCase
{
    public function test_store_and_load_latest_measurement(): void
    {
        $user = User::factory()->create();
        $service = $this->app->make(CpapMeasurementService::class);

        $measurement = $service->store($user->id, [
            'profile' => [
                'gender' => 'male',
                'ageGroup' => '30s',
                'tossing' => 'medium',
                'mouthBreathing' => false,
                'pressure' => 'medium',
                'preferredTypes' => [],
            ],
            'measurements' => ['faceWidth' => 140, 'noseWidth' => 38],
            'profile_measurements' => ['sideDepth' => 80],
            'recommendation' => [
                'type' => 'nasal',
                'name' => '나잘 마스크',
                'confidence' => 86,
            ],
            'metadata' => ['frames' => 90],
        ]);

        $latest = $service->latestForUser($user->id);

        $this->assertNotNull($latest);
        $this->assertSame($measurement->id, $latest->id);
        // 서버 재계산 결과(권위) — 클라이언트가 보낸 confidence(86)가 아니라 서버 도출값.
        $this->assertSame('nasal', $latest->mask_type);
        $this->assertSame(75.0, $latest->confidence);
        $this->assertSame('나잘 마스크 M', $latest->recommendation['name']);
    }

    public function test_store_ignores_client_supplied_recommendation(): void
    {
        $user = User::factory()->create();
        $service = $this->app->make(CpapMeasurementService::class);

        // 악의적 클라이언트: 임의 type/confidence/name 주입 시도.
        $measurement = $service->store($user->id, [
            'profile' => [
                'gender' => 'male',
                'ageGroup' => '30s',
                'tossing' => 'medium',
                'mouthBreathing' => false,
                'pressure' => 'medium',
                'preferredTypes' => [],
            ],
            'measurements' => ['faceWidth' => 140, 'noseWidth' => 38],
            'profile_measurements' => null,
            'recommendation' => [
                'type' => '<script>alert(1)</script>',
                'name' => 'HACKED 풀페이스',
                'confidence' => 100,
                'reasons' => ['INJECTED'],
            ],
        ]);

        // 서버 도출값으로 대체됨(클라이언트 값 미신뢰).
        $this->assertSame('nasal', $measurement->mask_type);
        $this->assertSame(75.0, $measurement->confidence);
        $this->assertSame('nasal', $measurement->recommendation['type']);
        $this->assertSame('나잘 마스크 M', $measurement->recommendation['name']);
        $this->assertNotContains('INJECTED', $measurement->recommendation['reasons']);
        $this->assertStringNotContainsString('<script>', json_encode($measurement->recommendation, JSON_UNESCAPED_UNICODE));
    }

    public function test_mouth_breathing_and_high_pressure_recommend_full_face(): void
    {
        $user = User::factory()->create();
        $service = $this->app->make(CpapMeasurementService::class);

        $measurement = $service->store($user->id, [
            'profile' => [
                'gender' => 'male',
                'ageGroup' => '20s',
                'tossing' => 'low',
                'mouthBreathing' => true,
                'pressure' => 'high',
                'preferredTypes' => [],
            ],
            'measurements' => [
                'noseWidth' => 40,
                'faceLength' => 160,
                'faceWidth' => 150,
                'mouthWidth' => 46,
                'philtrumLength' => 16,
                'bridgeWidth' => 32,
            ],
            'profile_measurements' => ['noseHeight' => 20],
            'recommendation' => ['type' => 'nasal', 'confidence' => 0],
        ]);

        $this->assertSame('full-face', $measurement->mask_type);
        $this->assertSame(90.0, $measurement->confidence);
        $this->assertSame('풀페이스 마스크 M', $measurement->recommendation['name']);
        $this->assertContains('구강호흡자에게 필수', $measurement->recommendation['reasons']);
    }
}
