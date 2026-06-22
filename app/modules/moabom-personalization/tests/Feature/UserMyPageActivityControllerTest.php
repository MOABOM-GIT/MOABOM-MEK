<?php

namespace Modules\Moabom\Personalization\Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Modules\Moabom\Personalization\Tests\Concerns\InteractsWithSirsoftBoardForTests;
use Modules\Moabom\Personalization\Tests\ModuleTestCase;

require_once dirname(__DIR__).'/ModuleTestCase.php';

class UserMyPageActivityControllerTest extends ModuleTestCase
{
    use InteractsWithSirsoftBoardForTests;

    private const ENDPOINT = '/api/modules/moabom-personalization/user/activities';

    protected function setUp(): void
    {
        parent::setUp();
        $this->ensureSirsoftBoardSchema();
    }

    private function authHeaders(User $user, string $locale = 'ko'): array
    {
        return [
            'Authorization' => 'Bearer '.$user->createToken('test-token')->plainTextToken,
            'Accept' => 'application/json',
            'Accept-Language' => $locale,
        ];
    }

    /**
     * 테스트용 게시판을 빠르게 생성합니다(BoardService 의존을 피하기 위한 직접 INSERT).
     */
    private function createBoard(string $slug = 'free', string $name = '자유'): int
    {
        return (int) DB::table('boards')->insertGetId([
            'name' => json_encode(['ko' => $name, 'en' => $name], JSON_UNESCAPED_UNICODE),
            'slug' => $slug,
            'is_active' => true,
            'description' => json_encode(['ko' => '', 'en' => ''], JSON_UNESCAPED_UNICODE),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function createPost(int $boardId, int $userId, string $title, string $content = '본문'): int
    {
        return (int) DB::table('board_posts')->insertGetId([
            'board_id' => $boardId,
            'title' => $title,
            'content' => $content,
            'content_mode' => 'text',
            'user_id' => $userId,
            'ip_address' => '127.0.0.1',
            'view_count' => 0,
            'depth' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function createComment(int $boardId, int $postId, int $userId, string $content = '댓글', ?int $parentId = null): int
    {
        return (int) DB::table('board_comments')->insertGetId([
            'board_id' => $boardId,
            'post_id' => $postId,
            'user_id' => $userId,
            'parent_id' => $parentId,
            'content' => $content,
            'depth' => $parentId ? 1 : 0,
            'ip_address' => '127.0.0.1',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_endpoint_requires_authentication(): void
    {
        $this->getJson(self::ENDPOINT)->assertStatus(401);
    }

    public function test_returns_empty_feed_for_user_without_activity(): void
    {
        $user = $this->createUserWithUserRole();

        $response = $this->withHeaders($this->authHeaders($user))
            ->getJson(self::ENDPOINT)
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.summary.posts_count', 0)
            ->assertJsonPath('data.summary.comments_count', 0)
            ->assertJsonPath('data.summary.interactions_count', 0)
            ->assertJsonPath('data.summary.likes_supported', false)
            ->assertJsonPath('data.query.type', 'all');

        $this->assertSame([], $response->json('data.items'));
    }

    public function test_returns_authored_posts_with_translated_label_in_korean(): void
    {
        $user = $this->createUserWithUserRole();
        $boardId = $this->createBoard();
        $this->createPost($boardId, $user->id, '내 글');

        $response = $this->withHeaders($this->authHeaders($user, 'ko'))
            ->getJson(self::ENDPOINT.'?type=posts')
            ->assertStatus(200)
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.type', 'post')
            ->assertJsonPath('data.items.0.type_label', '작성글')
            ->assertJsonPath('data.items.0.title', '내 글')
            ->assertJsonPath('data.items.0.board_slug', 'free')
            ->assertJsonPath('data.summary.posts_count', 1);

        $postId = (int) $response->json('data.items.0.post_id');
        $response->assertJsonPath('data.items.0.target_url', '/board/free/'.$postId);

        $meta = $response->json('data.items.0.meta');
        $this->assertStringContainsString('조회', $meta);
        $this->assertStringContainsString('댓글', $meta);
    }

    public function test_returns_authored_posts_with_translated_label_in_english(): void
    {
        $user = $this->createUserWithUserRole('en');
        $boardId = $this->createBoard();
        $this->createPost($boardId, $user->id, 'My Post');

        $this->withHeaders($this->authHeaders($user, 'en'))
            ->getJson(self::ENDPOINT.'?type=posts')
            ->assertStatus(200)
            ->assertJsonPath('data.items.0.type_label', 'Posts')
            ->assertJsonPath('data.items.0.meta', fn ($value) => is_string($value) && str_contains($value, 'Views'));
    }

    public function test_returns_authored_comments_only_when_type_is_comments(): void
    {
        $user = $this->createUserWithUserRole('en');
        $other = User::factory()->create();
        $boardId = $this->createBoard();
        $postId = $this->createPost($boardId, $other->id, 'Other Post');
        $this->createComment($boardId, $postId, $user->id, 'My Comment');

        $response = $this->withHeaders($this->authHeaders($user, 'en'))
            ->getJson(self::ENDPOINT.'?type=comments')
            ->assertStatus(200)
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.type', 'comment')
            ->assertJsonPath('data.items.0.type_label', 'Comments')
            ->assertJsonPath('data.items.0.title', 'Other Post')
            ->assertJsonPath('data.items.0.meta', 'You left a comment.');

        $commentId = (int) $response->json('data.items.0.comment_id');
        $response->assertJsonPath('data.items.0.target_url', '/board/free/'.$postId.'#comment-'.$commentId);
    }

    public function test_returns_received_interactions_with_correct_labels(): void
    {
        $owner = $this->createUserWithUserRole('en');
        $stranger = User::factory()->create();
        $boardId = $this->createBoard();

        // 1) 내 글에 다른 사용자가 댓글
        $myPostId = $this->createPost($boardId, $owner->id, 'Owner Post');
        $this->createComment($boardId, $myPostId, $stranger->id, 'comment by stranger');

        // 2) 내 댓글에 다른 사용자가 답글
        $otherPostId = $this->createPost($boardId, $stranger->id, 'Stranger Post');
        $myCommentId = $this->createComment($boardId, $otherPostId, $owner->id, 'comment by owner');
        $this->createComment($boardId, $otherPostId, $stranger->id, 'reply by stranger', $myCommentId);

        $response = $this->withHeaders($this->authHeaders($owner, 'en'))
            ->getJson(self::ENDPOINT.'?type=interactions')
            ->assertStatus(200)
            ->assertJsonPath('data.summary.interactions_count', 2);

        $items = $response->json('data.items');
        $this->assertCount(2, $items);

        $labels = array_column($items, 'type_label');
        $this->assertContains('Comment on my post', $labels);
        $this->assertContains('Reply to my comment', $labels);

        foreach ($items as $item) {
            $this->assertSame('interaction', $item['type']);
            $this->assertNotEmpty($item['target_url']);
        }
    }

    public function test_all_type_merges_and_sorts_by_occurred_at_desc(): void
    {
        $user = $this->createUserWithUserRole();
        $boardId = $this->createBoard();
        $postId = $this->createPost($boardId, $user->id, 'older post');

        // 댓글이 더 나중에 발생하도록 1초 지연 후 INSERT
        sleep(1);
        $this->createComment($boardId, $postId, $user->id, 'newer comment');

        $response = $this->withHeaders($this->authHeaders($user))
            ->getJson(self::ENDPOINT.'?type=all')
            ->assertStatus(200)
            ->assertJsonCount(2, 'data.items');

        $items = $response->json('data.items');
        $this->assertSame('comment', $items[0]['type']);
        $this->assertSame('post', $items[1]['type']);
    }

    public function test_invalid_type_falls_back_to_all(): void
    {
        $user = $this->createUserWithUserRole();

        $this->withHeaders($this->authHeaders($user))
            ->getJson(self::ENDPOINT.'?type=garbage')
            ->assertStatus(200)
            ->assertJsonPath('data.query.type', 'all');
    }

    public function test_limit_is_clamped_between_1_and_50(): void
    {
        $user = $this->createUserWithUserRole();

        $this->withHeaders($this->authHeaders($user))
            ->getJson(self::ENDPOINT.'?limit=999')
            ->assertJsonPath('data.query.limit', 50);

        $this->withHeaders($this->authHeaders($user))
            ->getJson(self::ENDPOINT.'?limit=0')
            ->assertJsonPath('data.query.limit', 1);
    }

    public function test_posts_pagination_returns_first_page_and_has_more(): void
    {
        $user = $this->createUserWithUserRole();
        $boardId = $this->createBoard();

        for ($i = 1; $i <= 12; $i++) {
            $this->createPost($boardId, $user->id, "post {$i}");
        }

        $this->withHeaders($this->authHeaders($user))
            ->getJson(self::ENDPOINT.'?type=posts&limit=10&offset=0')
            ->assertStatus(200)
            ->assertJsonCount(10, 'data.items')
            ->assertJsonPath('data.pagination.has_more', true)
            ->assertJsonPath('data.pagination.total', 12)
            ->assertJsonPath('data.query.offset', 0);

        $this->withHeaders($this->authHeaders($user))
            ->getJson(self::ENDPOINT.'?type=posts&limit=10&offset=10')
            ->assertStatus(200)
            ->assertJsonCount(2, 'data.items')
            ->assertJsonPath('data.pagination.has_more', false)
            ->assertJsonPath('data.query.offset', 10);
    }

    public function test_authenticated_user_without_roles_can_fetch_own_empty_feed(): void
    {
        // 역할·권한이 없어도 본인 활동 API는 Sanctum 인증만으로 조회 가능(본인 데이터만 반환)
        $user = User::factory()->create();

        $response = $this->withHeaders($this->authHeaders($user))
            ->getJson(self::ENDPOINT)
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.summary.posts_count', 0);

        $this->assertSame([], $response->json('data.items'));
    }
}
