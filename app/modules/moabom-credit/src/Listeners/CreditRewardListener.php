<?php

namespace Modules\Moabom\Credit\Listeners;

use App\Contracts\Extension\HookListenerInterface;
use App\Models\User;
use Modules\Moabom\Credit\Services\CreditRewardService;

final class CreditRewardListener implements HookListenerInterface
{
    public function __construct(
        private CreditRewardService $rewardService,
    ) {}

    public static function getSubscribedHooks(): array
    {
        return [
            'core.auth.after_login' => [
                'method' => 'onLogin',
                'priority' => 30,
            ],
            'sirsoft-board.post.after_create' => [
                'method' => 'onPostCreate',
                'priority' => 30,
            ],
            'sirsoft-board.comment.after_create' => [
                'method' => 'onCommentCreate',
                'priority' => 30,
            ],
        ];
    }

    public function handle(...$args): void {}

    public function onLogin(...$args): void
    {
        $user = $args[0] ?? null;
        if (! $user instanceof User) {
            return;
        }

        $this->rewardService->rewardLogin($user);
    }

    public function onPostCreate(...$args): void
    {
        $post = $args[0] ?? null;
        if (! is_object($post) || empty($post->user_id)) {
            return;
        }

        if (! $this->isPublishedBoardContent($post)) {
            return;
        }

        $author = $post->user ?? null;
        if (! $author instanceof User) {
            $author = User::query()->find((int) $post->user_id);
        }

        if (! $author instanceof User) {
            return;
        }

        $this->rewardService->rewardPostWrite($author, (int) $post->id);
    }

    public function onCommentCreate(...$args): void
    {
        $comment = $args[0] ?? null;
        if (! is_object($comment) || empty($comment->user_id)) {
            return;
        }

        if (! $this->isPublishedBoardContent($comment)) {
            return;
        }

        $author = $comment->user ?? null;
        if (! $author instanceof User) {
            $author = User::query()->find((int) $comment->user_id);
        }

        if (! $author instanceof User) {
            return;
        }

        $this->rewardService->rewardCommentWrite($author, (int) $comment->id);
    }

    private function isPublishedBoardContent(object $content): bool
    {
        $status = $content->status ?? null;
        if (is_object($status) && property_exists($status, 'value')) {
            return (string) $status->value === 'published';
        }

        return (string) $status === 'published';
    }
}
