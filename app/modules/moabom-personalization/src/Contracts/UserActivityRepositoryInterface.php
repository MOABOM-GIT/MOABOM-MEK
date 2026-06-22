<?php

namespace Modules\Moabom\Personalization\Contracts;

use Illuminate\Database\Eloquent\Collection;

/**
 * 마이페이지 활동 피드 데이터 접근 계약(sirsoft-board 연동).
 *
 * 변환/표현 로직은 포함하지 않는다. tenant 에 게시판이 없을 수 있으므로
 * 호출 전 {@see self::boardTablesAvailable()} 로 가드해야 한다.
 */
interface UserActivityRepositoryInterface
{
    /**
     * sirsoft-board 핵심 테이블(`board_posts`·`board_comments`)이 현재 tenant 에 존재하는지 확인합니다.
     */
    public function boardTablesAvailable(): bool;

    /**
     * 사용자가 작성한 게시글을 최신순으로 조회합니다.
     *
     * @return Collection<int, \Modules\Sirsoft\Board\Models\Post>
     */
    public function authoredPosts(int $userId, int $limit, int $offset = 0): Collection;

    /**
     * 사용자가 작성한 댓글을 최신순으로 조회합니다.
     *
     * @return Collection<int, \Modules\Sirsoft\Board\Models\Comment>
     */
    public function authoredComments(int $userId, int $limit, int $offset = 0): Collection;

    /**
     * 사용자의 게시글에 달린 타인의 댓글을 최신순으로 조회합니다.
     *
     * @return Collection<int, \Modules\Sirsoft\Board\Models\Comment>
     */
    public function receivedPostComments(int $userId, int $limit, int $offset = 0): Collection;

    /**
     * 사용자의 댓글에 달린 타인의 답글을 최신순으로 조회합니다.
     *
     * @return Collection<int, \Modules\Sirsoft\Board\Models\Comment>
     */
    public function receivedReplyComments(int $userId, int $limit, int $offset = 0): Collection;

    /**
     * 사용자가 작성한 게시글 수.
     */
    public function postsCount(int $userId): int;

    /**
     * 사용자가 작성한 댓글 수.
     */
    public function commentsCount(int $userId): int;

    /**
     * 사용자가 받은 상호작용(받은 댓글 + 받은 답글) 수.
     */
    public function receivedInteractionsCount(int $userId): int;
}
