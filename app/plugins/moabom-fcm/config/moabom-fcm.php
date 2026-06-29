<?php

declare(strict_types=1);

return [
    'enabled' => (bool) env('MOABOM_FCM_ENABLED', false),
    'project_id' => env('MOABOM_FCM_PROJECT_ID'),
    'service_account_json' => env('MOABOM_FCM_SERVICE_ACCOUNT_JSON'),
    'driver' => env('MOABOM_FCM_DRIVER', 'null'),
];
