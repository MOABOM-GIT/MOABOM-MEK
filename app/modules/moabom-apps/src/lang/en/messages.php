<?php

return [
    'apps' => [
        'ai' => [
            'generate_success' => 'Generated AI app HTML.',
            'stream_started' => 'Started streaming AI app HTML.',
            'continue_default_prompt' => 'Continue and complete the remaining HTML from where it was cut off.',
            'session_fetch_success' => 'Loaded the AI generation session.',
            'session_not_found' => 'AI generation session not found.',
            'session_resume_available' => 'A session is available to resume.',
            'session_cancel_success' => 'Generation stopped and the session was cleared.',
            'notice' => [
                'default' => 'Default preview shown until an AI provider is configured.',
                'anthropic_no_key' => 'The Anthropic API key is not configured, so a preview HTML was generated.',
                'anthropic_failed' => 'The Anthropic API request failed, so a preview HTML was generated.',
                'openai_no_key' => 'The OpenAI API key is not configured, so a preview HTML was generated.',
                'openai_failed' => 'The AI generation API request failed, so a preview HTML was generated.',
                'google_no_key' => 'The Google AI API key is not configured, so a preview HTML was generated.',
                'google_failed' => 'The Google AI API request failed, so a preview HTML was generated.',
            ],
        ],
        'generated' => [
            'fetch_success' => 'Loaded generated apps.',
            'show_success' => 'Loaded the generated app.',
            'not_found' => 'Generated app not found.',
            'save_success' => 'Saved the generated app.',
            'update_success' => 'Updated the generated app.',
            'share_success' => 'Updated generated app sharing.',
            'delete_success' => 'Deleted the generated app.',
            'owner_unknown' => 'Unknown creator',
        ],
    ],
];
