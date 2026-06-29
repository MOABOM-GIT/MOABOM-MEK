<?php

return [
    'home_background' => [
        'gd_required' => 'PHP GD extension is required to process images.',
        'invalid_type' => 'Only JPEG and PNG images can be uploaded (WebP requires GD WebP support on the server).',
        'webp_not_supported' => 'This server cannot process WebP images. Please upload JPEG or PNG.',
        'storage_write_failed' => 'Could not write to the image storage path. Check permissions for storage/app/modules/moabom-system.',
        'empty_file' => 'The file is empty.',
        'decode_failed' => 'Could not read the image.',
        'invalid_dimensions' => 'The image dimensions are invalid.',
        'encode_failed' => 'Failed to encode the image.',
        'upload_success' => 'Home background image uploaded.',
        'upload_failed' => 'Failed to upload the home background image.',
        'delete_success' => 'Home background image deleted.',
        'delete_failed' => 'Failed to delete the home background image.',
    ],
    'validation' => [
        'invalid_background_image_id' => 'Background id must be 1–13 or a UUID of an uploaded image.',
    ],
    'settings' => [
        'fetch_success' => 'My Page settings have been loaded.',
        'save_success' => 'My Page settings have been saved.',
        'save_failed' => 'Failed to save My Page settings.',
        'clear_cache_success' => 'My Page settings cache has been cleared.',
    ],
    'user' => [
        'fetch_success' => 'User system settings have been loaded.',
        'save_success' => 'User system settings have been saved.',
    ],
    'public_defaults' => [
        'fetch_success' => 'Platform default settings have been loaded.',
    ],
    'public_shell_boot' => [
        'fetch_success' => 'Shell boot data has been loaded.',
    ],
    'extension_boot_meta' => [
        'fetch_success' => 'Extension boot metadata has been loaded.',
    ],
    'shell_routes' => [
        'fetch_success' => 'Shell route snapshot has been loaded.',
        'template_not_found' => 'Template not found: :template',
        'routes_not_found' => 'Template routes.json could not be found.',
        'invalid_json' => 'routes.json is not valid JSON.',
        'unknown_error' => 'Could not load route data.',
    ],
    'shell_rankings' => [
        'usage_accepted' => 'App usage has been recorded.',
        'apps_fetch_success' => 'App rankings have been loaded.',
        'users_fetch_success' => 'User rankings have been loaded.',
    ],
    'saas' => [
        'hospitals' => [
            'list_success' => 'Company list loaded.',
            'show_success' => 'Company loaded.',
            'created' => 'Company tenant added.',
            'not_found' => 'Company not found.',
            'validation_failed' => 'Invalid company add request.',
            'provision_failed' => 'Company provisioning failed.',
            'packages_success' => 'Company package catalog loaded.',
            'usage_success' => 'Company usage loaded.',
            'usage_failed' => 'Failed to measure company usage.',
            'purge_success' => 'Company data purge completed.',
            'purge_failed' => 'Company data purge failed.',
            'purge_validation_failed' => 'Invalid purge confirmation input.',
            'destroy_success' => 'Company fully destroyed.',
            'destroy_failed' => 'Company destroy failed.',
            'destroy_validation_failed' => 'Invalid destroy confirmation input.',
            'operation_success' => 'Operation status loaded.',
            'operation_not_found' => 'Operation record not found.',
        ],
    ],
    'realtime_vm_status_success' => 'Realtime VM status loaded.',
    'realtime_vm_refresh_success' => 'Realtime VM status refreshed.',
    // All 'apps.*' keys are moved to dedicated modules (2026-06-02).
    // - apps.ai.*, apps.generated.*: moabom-apps
    // - apps.cpap.*: moabom-cpap
];
