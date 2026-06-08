<?php

return [
    'mypage_activity' => [
        'fetch_success' => 'Activities loaded successfully.',
        'fetch_failed' => 'Failed to load activities.',
        'types' => [
            'post' => 'Posts',
            'comment' => 'Comments',
        ],
        'interactions' => [
            'post_comment' => 'Comment on my post',
            'reply' => 'Reply to my comment',
        ],
        'meta' => [
            'post_stats' => 'Views :views · Comments :comments',
            'comment_left' => 'You left a comment.',
            'actor_label' => ':actor · :label',
        ],
        'fallback' => [
            'post_title' => 'Post',
            'actor' => 'User',
        ],
    ],
];
