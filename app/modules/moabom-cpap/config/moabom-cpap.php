<?php

$rulesPath = dirname(__DIR__).'/resources/recommend-rules.json';
$rules = json_decode((string) file_get_contents($rulesPath), true, 512, JSON_THROW_ON_ERROR);

return [
    /*
    |--------------------------------------------------------------------------
    | CPAP 마스크 추천 규칙 (recommend-rules.json SSOT)
    |--------------------------------------------------------------------------
    |
    | 프론트 cpapRecommendMask.ts 도 동일 JSON 을 import 한다.
    | 알고리즘 본체는 서버(CpapRecommendEngine) / 클라이언트(recommendMask)에 각각
    | 있으나 계수·문구·임계값은 이 파일만 수정한다.
    |
    */
    'recommend_rules' => $rules,
];
