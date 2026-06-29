<?php

namespace Modules\Moabom\Credit\Listeners;

use App\Contracts\Extension\HookListenerInterface;
use App\Models\User;
use Modules\Moabom\Credit\Services\CreditRewardService;

final class CreditAppReviewRewardListener implements HookListenerInterface
{
    public function __construct(
        private CreditRewardService $rewardService,
    ) {}

    public static function getSubscribedHooks(): array
    {
        return [
            'moabom-apps.community_review.after_create' => [
                'method' => 'onReviewCreated',
                'priority' => 30,
            ],
        ];
    }

    public function handle(...$args): void {}

    public function onReviewCreated(...$args): void
    {
        $post = $args[0] ?? null;
        if (! is_object($post) || empty($post->id) || empty($post->user_id)) {
            return;
        }

        $author = $post->user ?? null;
        if (! $author instanceof User) {
            $author = User::query()->find((int) $post->user_id);
        }

        if (! $author instanceof User) {
            return;
        }

        $this->rewardService->rewardAppReviewWrite($author, (int) $post->id);
    }
}
