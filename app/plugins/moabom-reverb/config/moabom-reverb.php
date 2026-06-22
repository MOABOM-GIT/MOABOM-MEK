<?php

/**
 * Reverb 기본값 — env·Run 시크릿은 deploy/production.env.yaml SSOT.
 * 클라이언트 host 만 테넌트별로 달라진다.
 */
return [
    'app_id' => env('REVERB_APP_ID', 'moabom-laravel'),
    'app_key' => env('REVERB_APP_KEY', 'moabom-laravel-key'),
    'app_secret' => env('REVERB_APP_SECRET', ''),
    'client_port' => (int) env('REVERB_CLIENT_PORT', 443),
    'client_scheme' => env('REVERB_CLIENT_SCHEME', 'https'),
    'verify_ssl' => filter_var(env('REVERB_VERIFY_SSL', true), FILTER_VALIDATE_BOOL),
    'server_host' => env('REVERB_SERVER_HOST', '127.0.0.1'),
    'server_port' => (int) env('REVERB_SERVER_PORT', 6001),
    'server_scheme' => env('REVERB_SERVER_SCHEME', 'http'),
];
