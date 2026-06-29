<?php

return [
    'mypage_activity' => [
        'fetch_success' => 'Posts loaded successfully.',
        'fetch_failed' => 'Failed to load posts.',
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
