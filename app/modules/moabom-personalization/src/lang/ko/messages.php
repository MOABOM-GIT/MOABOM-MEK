<?php

return [
    'mypage_activity' => [
        'fetch_success' => '내 활동을 성공적으로 가져왔습니다.',
        'fetch_failed' => '내 활동을 가져오는데 실패했습니다.',
        'types' => [
            'post' => '작성글',
            'comment' => '작성댓글',
        ],
        'interactions' => [
            'post_comment' => '내 게시글에 댓글',
            'reply' => '내 댓글에 답글',
        ],
        'meta' => [
            'post_stats' => '조회 :views · 댓글 :comments',
            'comment_left' => '내가 댓글을 남겼습니다.',
            'actor_label' => ':actor · :label',
        ],
        'fallback' => [
            'post_title' => '게시글',
            'actor' => '사용자',
        ],
    ],
];
