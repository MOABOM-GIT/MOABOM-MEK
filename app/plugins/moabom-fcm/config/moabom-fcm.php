<?php

declare(strict_types=1);

return [
    'enabled' => (bool) env('MOABOM_FCM_ENABLED', false),
    'project_id' => env('MOABOM_FCM_PROJECT_ID'),
    'service_account_json' => env('MOABOM_FCM_SERVICE_ACCOUNT_JSON'),
    'driver' => env('MOABOM_FCM_DRIVER', 'null'),
    'web' => [
        'api_key' => env('MOABOM_FCM_WEB_API_KEY'),
        'auth_domain' => env('MOABOM_FCM_WEB_AUTH_DOMAIN'),
        'project_id' => env('MOABOM_FCM_WEB_PROJECT_ID', env('MOABOM_FCM_PROJECT_ID')),
        'messaging_sender_id' => env('MOABOM_FCM_MESSAGING_SENDER_ID'),
        'app_id' => env('MOABOM_FCM_WEB_APP_ID'),
        'vapid_key' => env('MOABOM_FCM_VAPID_KEY'),
    ],
];
