<?php

return [
    'fetch_success' => 'Credit information retrieved successfully.',
    'fetch_failed' => 'Failed to retrieve credit information.',
    'invalid_amount' => 'Credit amount cannot be zero.',
    'insufficient_balance' => 'Insufficient credit balance.',
    'daily_limit_exceeded' => 'Daily credit earning limit has been exceeded.',
    'attendance' => [
        'success' => 'Attendance credit has been added.',
        'failed' => 'Failed to process attendance check.',
        'already_checked' => 'You have already checked in today.',
        'disabled' => 'Attendance rewards are disabled.',
        'ad_required' => 'Watch an ad before receiving attendance rewards.',
        'transaction_description' => 'Attendance reward',
    ],
    'settings' => [
        'fetch_success' => 'Credit settings retrieved successfully.',
        'save_success' => 'Credit settings saved successfully.',
        'save_failed' => 'Failed to save credit settings.',
        'clear_cache_success' => 'Credit settings cache cleared successfully.',
    ],
    'types' => [
        'earn' => 'Earned',
        'spend' => 'Spent',
        'adjust' => 'Adjusted',
        'expire' => 'Expired',
    ],
    'rewards' => [
        'login_description' => 'Login reward',
        'post_write_description' => 'Post write reward',
        'comment_write_description' => 'Comment write reward',
        'app_review_write_description' => 'App review write reward',
        'like_received_description' => 'Received like reward',
    ],
    'admin' => [
        'user_credits_list_success' => 'User credit list loaded.',
        'adjust_success' => 'User credits adjusted.',
        'adjust_failed' => 'Failed to adjust user credits.',
        'invalid_direction' => 'Invalid adjustment direction.',
        'increase_default_description' => 'Manual increase by admin',
        'decrease_default_description' => 'Manual decrease by admin',
        'delete_success' => 'User credit data deleted.',
        'delete_failed' => 'Failed to delete user credit data.',
    ],
];
