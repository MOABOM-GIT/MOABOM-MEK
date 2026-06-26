<?php

namespace Modules\Moabom\Credit\Tests\Unit;

use App\Models\User;
use Modules\Moabom\Credit\Enums\CreditTransactionType;
use Modules\Moabom\Credit\Models\CreditTransaction;
use Modules\Moabom\Credit\Services\CreditRewardService;
use Modules\Moabom\Credit\Tests\ModuleTestCase;

class CreditRewardServiceTest extends ModuleTestCase
{
    private CreditRewardService $rewardService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->rewardService = app(CreditRewardService::class);
    }

    public function test_reward_comment_write_increments_ranking_points(): void
    {
        $user = User::factory()->create();

        $this->rewardService->rewardCommentWrite($user, 1);

        $balance = \Modules\Moabom\Credit\Models\CreditBalance::query()
            ->where('user_id', $user->id)
            ->first();

        $this->assertNotNull($balance);
        $this->assertSame(2, (int) $balance->ranking_points);
    }

    public function test_reward_comment_write_respects_daily_limit(): void
    {
        $user = User::factory()->create();

        $this->rewardService->rewardCommentWrite($user, 1);
        $this->rewardService->rewardCommentWrite($user, 2);

        $count = CreditTransaction::query()
            ->where('user_id', $user->id)
            ->where('source_type', 'comment_write')
            ->count();

        $this->assertSame(2, $count);

        for ($index = 3; $index <= 25; $index++) {
            $this->rewardService->rewardCommentWrite($user, $index);
        }

        $limitedCount = CreditTransaction::query()
            ->where('user_id', $user->id)
            ->where('source_type', 'comment_write')
            ->where('type', CreditTransactionType::Earn->value)
            ->count();

        $this->assertSame(20, $limitedCount);
    }

    public function test_reward_login_is_idempotent_per_day(): void
    {
        $user = User::factory()->create();

        $this->rewardService->rewardLogin($user);
        $this->rewardService->rewardLogin($user);

        $count = CreditTransaction::query()
            ->where('user_id', $user->id)
            ->where('source_type', 'login')
            ->count();

        $this->assertSame(1, $count);
    }
}
