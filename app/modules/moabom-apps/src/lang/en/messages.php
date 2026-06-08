<?php

return [
    'apps' => [
        'ai' => [
            'generate_success' => 'Generated AI app HTML.',
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
        ],
    ],
];
