<?php

namespace Modules\Moabom\Cpap\Tests\Unit;

use Illuminate\Support\Facades\Validator;
use Modules\Moabom\Cpap\Http\Requests\StoreCpapMeasurementRequest;
use Modules\Moabom\Cpap\Tests\ModuleTestCase;

class StoreCpapMeasurementRequestTest extends ModuleTestCase
{
    public function test_validates_profile_contract(): void
    {
        $passes = Validator::make([
            'profile' => [
                'gender' => 'male',
                'ageGroup' => '30s',
                'tossing' => 'medium',
                'mouthBreathing' => false,
                'pressure' => 'medium',
                'preferredTypes' => ['nasal'],
            ],
            'measurements' => ['faceWidth' => 140],
            'recommendation' => [
                'type' => 'nasal',
                'name' => '나잘 마스크',
                'confidence' => 88,
            ],
        ], (new StoreCpapMeasurementRequest)->rules())->passes();

        $this->assertTrue($passes);
    }
}
