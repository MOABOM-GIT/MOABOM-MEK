<?php

return [
    /*
    |--------------------------------------------------------------------------
    | 수익성 시뮬레이션 기본 가정값 (Profitability simulation defaults)
    |--------------------------------------------------------------------------
    |
    | 360 컨설팅.pptx / 파트너십 서비스 계약 시나리오_v2.xlsx 에서 도출한 기준값.
    | 프론트 simulationModel.ts 와 서버 ProfitabilitySimulationService 가 동일한
    | 기본값을 공유하도록 SSOT 로 둔다. 단위: 원(KRW), 비율(0~1).
    |
    */
    'simulation' => [
        'defaults' => [
            'initial_patients' => 0,        // 관리 환자 수(초기)
            'monthly_new_patients' => 15,   // 월 처방 수(신규/월)
            'staff_count' => 1,             // 배치 인력 수
            'staff_salary' => 3_000_000,    // 인력 1인 월 급여
            'equipment_price' => 900_000,   // 장비 대당 구매가(자체운영 capex)
            'refurbish_cost' => 80_000,     // 리퍼비시/관리비용(대당)
            'adherence_pass_rate' => 0.85,  // 순응 통과율
            'annual_retention' => 0.65,     // 연간 유지율
            'years' => 5,                   // 시뮬레이션 기간(년)
        ],
        // 1인당 월 매출/비용 계수 (시나리오 엑셀 구조 기반 근사치)
        'coefficients' => [
            'self' => [
                'rental_revenue_per_patient' => 75_000,   // 자체운영: 청구효율 낮음
                'consumable_cost_per_patient' => 6_000,
                'monthly_rent' => 1_000_000,
            ],
            'smart' => [
                'rental_revenue_per_patient' => 95_000,   // 360: 전문 청구팀 → 청구효율 높음
                'service_fee_per_patient' => 38_000,      // MEK 통합 서비스비용(렌탈+리퍼비시+청구+프로그램)
                'monthly_rent' => 1_000_000,
            ],
        ],
    ],
];
