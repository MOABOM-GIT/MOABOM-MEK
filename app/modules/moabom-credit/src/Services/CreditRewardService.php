<?php

namespace Modules\Moabom\Credit\Services;

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;
use Modules\Moabom\Credit\Enums\CreditRewardSourceType;
use Modules\Moabom\Credit\Enums\CreditTransactionType;
use Modules\Moabom\Credit\Models\CreditTransaction;

final class CreditRewardService
{
    public function __construct(
        private CreditService $creditService,
        private CreditSettingsService $settingsService,
    ) {}

    public function rewardLogin(User $user): void
    {
        $today = CarbonImmutable::now()->toDateString();
        $this->maybeReward(
            $user,
            'rewards.login_enabled',
            'rewards.login_amount',
            CreditRewardSourceType::Login,
            $today,
            null,
            __('moabom-credit::messages.rewards.login_description'),
        );
    }

    public function rewardPostWrite(User $user, int|string $postId): void
    {
        $this->maybeReward(
            $user,
            'rewards.post_write_enabled',
            'rewards.post_write_amount',
            CreditRewardSourceType::PostWrite,
            (string) $postId,
            'limits.max_post_write_rewards_per_day',
            __('moabom-credit::messages.rewards.post_write_description'),
            ['post_id' => (int) $postId],
        );
    }

    public function rewardCommentWrite(User $user, int|string $commentId): void
    {
        $this->maybeReward(
            $user,
            'rewards.comment_write_enabled',
            'rewards.comment_write_amount',
            CreditRewardSourceType::CommentWrite,
            (string) $commentId,
            'limits.max_comment_write_rewards_per_day',
            __('moabom-credit::messages.rewards.comment_write_description'),
            ['comment_id' => (int) $commentId],
        );
    }

    public function rewardLikeReceived(User $user, int|string $postId, int|string $eventId): void
    {
        $this->maybeReward(
            $user,
            'rewards.like_received_enabled',
            'rewards.like_received_amount',
            CreditRewardSourceType::LikeReceived,
            (string) $eventId,
            'limits.max_like_received_rewards_per_day',
            __('moabom-credit::messages.rewards.like_received_description'),
            ['post_id' => (int) $postId],
        );
    }

    private function maybeReward(
        User $user,
        string $enabledKey,
        string $amountKey,
        CreditRewardSourceType $sourceType,
        string $sourceId,
        ?string $dailyLimitKey,
        string $description,
        ?array $meta = null,
    ): void {
        if (! (bool) $this->settingsService->getSetting($enabledKey, true)) {
            return;
        }

        $amount = (int) $this->settingsService->getSetting($amountKey, 0);
        if ($amount <= 0) {
            return;
        }

        if ($this->hasExistingReward($user->id, $sourceType->value, $sourceId)) {
            return;
        }

        if ($dailyLimitKey !== null && $this->isDailyCountLimitReached($user->id, $sourceType->value, $dailyLimitKey)) {
            return;
        }

        try {
            $this->creditService->recordTransaction(
                $user,
                CreditTransactionType::Earn,
                $amount,
                $description,
                $sourceType->value,
                $sourceId,
                $meta,
            );
        } catch (InvalidArgumentException $exception) {
            Log::debug('moabom_credit_reward_skipped', [
                'user_id' => $user->id,
                'source_type' => $sourceType->value,
                'source_id' => $sourceId,
                'reason' => $exception->getMessage(),
            ]);
        }
    }

    private function hasExistingReward(int $userId, string $sourceType, string $sourceId): bool
    {
        return CreditTransaction::query()
            ->where('user_id', $userId)
            ->where('type', CreditTransactionType::Earn->value)
            ->where('source_type', $sourceType)
            ->where('source_id', $sourceId)
            ->exists();
    }

    private function isDailyCountLimitReached(int $userId, string $sourceType, string $dailyLimitKey): bool
    {
        $limit = (int) $this->settingsService->getSetting($dailyLimitKey, 0);
        if ($limit <= 0) {
            return false;
        }

        $todayCount = CreditTransaction::query()
            ->where('user_id', $userId)
            ->where('type', CreditTransactionType::Earn->value)
            ->where('source_type', $sourceType)
            ->whereDate('created_at', CarbonImmutable::now()->toDateString())
            ->count();

        return $todayCount >= $limit;
    }
}
