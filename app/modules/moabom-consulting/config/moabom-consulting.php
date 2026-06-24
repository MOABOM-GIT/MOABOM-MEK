<?php

$modelPath = dirname(__DIR__).'/resources/simulation-model.json';
$model = json_decode((string) file_get_contents($modelPath), true, 512, JSON_THROW_ON_ERROR);

return [
    /*
    |--------------------------------------------------------------------------
    | 수익성 시뮬레이션 기본 가정값 (Profitability simulation defaults)
    |--------------------------------------------------------------------------
    |
    | SSOT: resources/simulation-model.json
    | 프론트 simulationModel.ts 도 동일 JSON 을 import 한다.
    | 출처: 360 컨설팅.pptx / 파트너십 서비스 계약 시나리오_v2.xlsx
    | 단위: 원(KRW), 비율(0~1).
    |
    */
    'simulation' => $model,
];
