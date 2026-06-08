<?php

return [
    /*
     * Validation messages for `StoreUserSystemSettingsRequest` when a user tries to override
     * an admin-locked or unknown system option (Req 8.1 / 8.2 / 8.4).
     */
    'system_option_locked' => 'This system option is locked by the administrator and cannot be changed. (option: :id)',
    'system_option_unknown' => 'Unknown system option. (option: :id)',
];
