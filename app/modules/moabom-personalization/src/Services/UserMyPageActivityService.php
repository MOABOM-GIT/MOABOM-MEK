<?php

namespace Modules\Moabom\Personalization\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Modules\Moabom\Personalization\Contracts\UserActivityRepositoryInterface;
use Modules\Sirsoft\Board\Models\Comment;
use Modules\Sirsoft\Board\Models\Post;

/**
 * 마이페이지 "내 활동" 피드 조립 서비스.
 *
 * 데이터 접근은 {@see UserActivityRepositoryInterface} 로 위임하고, 본 서비스는
 * 표현용 항목 변환(라벨/아이콘/URL/상대시간)과 피드 병합·정렬만 담당한다.
 * sirsoft-board 가 미설치/비활성인 tenant 는 빈 피드 payload 를 반환한다.
 */
class UserMyPageActivityService
{
    private const TRANSLATION_NAMESPACE = 'moabom-personalization::messages';

    public function __construct(
        private readonly UserActivityRepositoryInterface $repository,
    ) {
    }

    /**
     * 마이페이지 활동 피드 응답 payload 를 조립합니다.
     *
     * @return array<string, mixed>
     */
    public function buildPayload(int $userId, string $type, int $limit): array
    {
        // sirsoft-board 가 미설치/비활성인 tenant 는 빈 피드를 반환한다.
        if (! $this->repository->boardTablesAvailable()) {
            return $this->emptyPayload($type, $limit);
        }

        $posts = in_array($type, ['all', 'posts'], true)
            ? $this->authoredPosts($userId, $limit)
            : collect();
        $comments = in_array($type, ['all', 'comments'], true)
            ? $this->authoredComments($userId, $limit)
            : collect();
        $interactions = in_array($type, ['all', 'interactions'], true)
            ? $this->receivedInteractions($userId, $limit)
            : collect();

        $items = $posts
            ->concat($comments)
            ->concat($interactions)
            ->sortByDesc('occurred_at')
            ->take($limit)
            ->values();

        return [
            'summary' => [
                'posts_count' => $this->repository->postsCount($userId),
                'comments_count' => $this->repository->commentsCount($userId),
                'interactions_count' => $this->repository->receivedInteractionsCount($userId),
                'likes_supported' => false,
            ],
            'items' => $items,
            'query' => [
                'type' => $type,
                'limit' => $limit,
            ],
        ];
    }

    /**
     * sirsoft-board 미설치/비활성 tenant 용 빈 피드 payload.
     *
     * @return array<string, mixed>
     */
    private function emptyPayload(string $type, int $limit): array
    {
        return [
            'summary' => [
                'posts_count' => 0,
                'comments_count' => 0,
                'interactions_count' => 0,
                'likes_supported' => false,
            ],
            'items' => [],
            'query' => [
                'type' => $type,
                'limit' => $limit,
            ],
        ];
    }

    /**
     * 사용자가 작성한 게시글 활동을 표현용 항목으로 변환합니다.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function authoredPosts(int $userId, int $limit): Collection
    {
        return $this->repository->authoredPosts($userId, $limit)
            ->map(fn (Post $post) => [
                'id' => 'post-'.$post->id,
                'type' => 'post',
                'type_label' => $this->trans('mypage_activity.types.post'),
                'icon' => 'file-alt',
                'title' => $post->title,
                'description' => $this->plainText($post->content ?? ''),
                'board_name' => $post->board?->getLocalizedName() ?? '',
                'board_slug' => $post->board?->slug,
                'post_id' => $post->id,
                'target_url' => $this->postUrl($post->board?->slug, $post->id),
                'meta' => $this->trans('mypage_activity.meta.post_stats', [
                    'views' => (int) ($post->view_count ?? 0),
                    'comments' => (int) ($post->comments_count ?? 0),
                ]),
                'occurred_at' => $post->created_at?->toISOString(),
                'occurred_at_human' => $this->humanDate($post->created_at),
            ]);
    }

    /**
     * 사용자가 작성한 댓글 활동을 표현용 항목으로 변환합니다.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function authoredComments(int $userId, int $limit): Collection
    {
        $fallbackTitle = $this->trans('mypage_activity.fallback.post_title');

        return $this->repository->authoredComments($userId, $limit)
            ->map(fn (Comment $comment) => [
                'id' => 'comment-'.$comment->id,
                'type' => 'comment',
                'type_label' => $this->trans('mypage_activity.types.comment'),
                'icon' => 'comment',
                'title' => $comment->post?->title ?? $fallbackTitle,
                'description' => $this->plainText($comment->content ?? ''),
                'board_name' => $comment->board?->getLocalizedName() ?? '',
                'board_slug' => $comment->board?->slug,
                'post_id' => $comment->post_id,
                'comment_id' => $comment->id,
                'target_url' => $this->postUrl($comment->board?->slug, $comment->post_id, $comment->id),
                'meta' => $this->trans('mypage_activity.meta.comment_left'),
                'occurred_at' => $comment->created_at?->toISOString(),
                'occurred_at_human' => $this->humanDate($comment->created_at),
            ]);
    }

    /**
     * 내 게시글/댓글에 발생한 다른 사용자의 상호작용을 변환합니다.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function receivedInteractions(int $userId, int $limit): Collection
    {
        $postCommentLabel = $this->trans('mypage_activity.interactions.post_comment');
        $replyLabel = $this->trans('mypage_activity.interactions.reply');

        $postComments = $this->repository->receivedPostComments($userId, $limit)
            ->map(fn (Comment $comment) => $this->receivedCommentItem($comment, $postCommentLabel));

        $replyComments = $this->repository->receivedReplyComments($userId, $limit)
            ->map(fn (Comment $comment) => $this->receivedCommentItem($comment, $replyLabel));

        return $postComments
            ->concat($replyComments)
            ->unique('id')
            ->sortByDesc('occurred_at')
            ->take($limit)
            ->values();
    }

    /**
     * 받은 댓글/답글 항목을 API 응답용으로 변환합니다.
     *
     * @return array<string, mixed>
     */
    private function receivedCommentItem(Comment $comment, string $label): array
    {
        $fallbackTitle = $this->trans('mypage_activity.fallback.post_title');
        $fallbackActor = $this->trans('mypage_activity.fallback.actor');
        $actor = $comment->user?->nickname ?: ($comment->user?->name ?: ($comment->author_name ?: $fallbackActor));

        return [
            'id' => 'interaction-comment-'.$comment->id,
            'type' => 'interaction',
            'type_label' => $label,
            'icon' => 'bell',
            'title' => $comment->post?->title ?? $fallbackTitle,
            'description' => $this->plainText($comment->content ?? ''),
            'actor_name' => $actor,
            'board_name' => $comment->board?->getLocalizedName() ?? '',
            'board_slug' => $comment->board?->slug,
            'post_id' => $comment->post_id,
            'comment_id' => $comment->id,
            'target_url' => $this->postUrl($comment->board?->slug, $comment->post_id, $comment->id),
            'meta' => $this->trans('mypage_activity.meta.actor_label', [
                'actor' => $actor,
                'label' => $label,
            ]),
            'occurred_at' => $comment->created_at?->toISOString(),
            'occurred_at_human' => $this->humanDate($comment->created_at),
        ];
    }

    /**
     * 게시글 URL을 반환합니다.
     */
    private function postUrl(?string $boardSlug, ?int $postId, ?int $commentId = null): ?string
    {
        if (! $boardSlug || ! $postId) {
            return null;
        }

        $url = "/board/{$boardSlug}/post/{$postId}";

        return $commentId ? "{$url}#comment-{$commentId}" : $url;
    }

    /**
     * HTML을 제거하고 한 줄 설명으로 줄입니다.
     */
    private function plainText(string $value): string
    {
        return mb_strimwidth(trim(preg_replace('/\s+/', ' ', strip_tags($value)) ?? ''), 0, 120, '...');
    }

    /**
     * 날짜를 사용자용 상대 시간으로 반환합니다.
     */
    private function humanDate(?Carbon $date): ?string
    {
        return $date?->diffForHumans();
    }

    /**
     * 모듈 다국어 키를 현재 로케일로 번역합니다.
     *
     * @param  array<string, mixed>  $replace
     */
    private function trans(string $key, array $replace = []): string
    {
        return (string) __(self::TRANSLATION_NAMESPACE.'.'.$key, $replace);
    }
}
