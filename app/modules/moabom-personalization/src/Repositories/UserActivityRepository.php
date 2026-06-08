<?php

namespace Modules\Moabom\Personalization\Repositories;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\Personalization\Contracts\UserActivityRepositoryInterface;
use Modules\Sirsoft\Board\Models\Comment;
use Modules\Sirsoft\Board\Models\Post;

class UserActivityRepository implements UserActivityRepositoryInterface
{
    /**
     * sirsoft-board 핵심 테이블이 현재 tenant 에 존재하는지 확인합니다.
     *
     * 실제 테이블명은 `board_posts`·`board_comments` 이며, tenant 가 게시판을
     * 미설치한 경우 두 테이블이 모두 없으므로 false 를 반환한다.
     */
    public function boardTablesAvailable(): bool
    {
        try {
            return Schema::hasTable('board_posts') && Schema::hasTable('board_comments');
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * @return Collection<int, Post>
     */
    public function authoredPosts(int $userId, int $limit): Collection
    {
        return Post::query()
            ->with('board')
            ->where('user_id', $userId)
            ->latest()
            ->limit($limit)
            ->get();
    }

    /**
     * @return Collection<int, Comment>
     */
    public function authoredComments(int $userId, int $limit): Collection
    {
        return Comment::query()
            ->with(['board', 'post'])
            ->where('user_id', $userId)
            ->latest()
            ->limit($limit)
            ->get();
    }

    /**
     * @return Collection<int, Comment>
     */
    public function receivedPostComments(int $userId, int $limit): Collection
    {
        return Comment::query()
            ->with(['board', 'post', 'user'])
            ->where('user_id', '!=', $userId)
            ->whereHas('post', fn ($query) => $query->where('user_id', $userId))
            ->latest()
            ->limit($limit)
            ->get();
    }

    /**
     * @return Collection<int, Comment>
     */
    public function receivedReplyComments(int $userId, int $limit): Collection
    {
        return Comment::query()
            ->with(['board', 'post', 'user'])
            ->where('user_id', '!=', $userId)
            ->whereHas('parent', fn ($query) => $query->where('user_id', $userId))
            ->latest()
            ->limit($limit)
            ->get();
    }

    public function postsCount(int $userId): int
    {
        return Post::where('user_id', $userId)->count();
    }

    public function commentsCount(int $userId): int
    {
        return Comment::where('user_id', $userId)->count();
    }

    public function receivedInteractionsCount(int $userId): int
    {
        $postComments = Comment::where('user_id', '!=', $userId)
            ->whereHas('post', fn ($query) => $query->where('user_id', $userId))
            ->count();
        $replyComments = Comment::where('user_id', '!=', $userId)
            ->whereHas('parent', fn ($query) => $query->where('user_id', $userId))
            ->count();

        return $postComments + $replyComments;
    }
}
