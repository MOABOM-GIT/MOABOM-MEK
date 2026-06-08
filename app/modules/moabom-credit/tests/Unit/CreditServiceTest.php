<?php

namespace Modules\Moabom\Credit\Tests\Unit;

use App\Models\User;
use InvalidArgumentException;
use Modules\Moabom\Credit\Enums\CreditTransactionType;
use Modules\Moabom\Credit\Services\CreditService;
use Modules\Moabom\Credit\Tests\ModuleTestCase;

require_once dirname(__DIR__).'/ModuleTestCase.php';

class CreditServiceTest extends ModuleTestCase
{
    private CreditService $creditService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->creditService = app(CreditService::class);
    }

    public function test_record_transaction_updates_balance_and_ledger(): void
    {
        $user = User::factory()->create();

        $transaction = $this->creditService->recordTransaction(
            $user,
            CreditTransactionType::Earn,
            300,
            '가입 보상'
        );

        $this->assertSame(300, $transaction->amount);
        $this->assertSame(300, $transaction->balance_after);
        $this->assertDatabaseHas('moabom_credit_balances', [
            'user_id' => $user->id,
            'balance' => 300,
        ]);
        $this->assertDatabaseHas('moabom_credit_transactions', [
            'user_id' => $user->id,
            'type' => CreditTransactionType::Earn->value,
            'amount' => 300,
            'description' => '가입 보상',
        ]);
    }

    public function test_spend_transaction_decreases_balance(): void
    {
        $user = User::factory()->create();
        $this->creditService->recordTransaction($user, CreditTransactionType::Earn, 500, '충전');

        $transaction = $this->creditService->recordTransaction(
            $user,
            CreditTransactionType::Spend,
            120,
            '앱 사용'
        );

        $this->assertSame(-120, $transaction->amount);
        $this->assertSame(380, $transaction->balance_after);
        $this->assertDatabaseHas('moabom_credit_balances', [
            'user_id' => $user->id,
            'balance' => 380,
        ]);
    }

    public function test_spend_transaction_cannot_make_balance_negative(): void
    {
        $user = User::factory()->create();

        $this->expectException(InvalidArgumentException::class);

        $this->creditService->recordTransaction($user, CreditTransactionType::Spend, 1, '초과 사용');
    }

    public function test_get_user_credit_overview_returns_summary_and_transactions(): void
    {
        $user = User::factory()->create();
        $this->creditService->recordTransaction($user, CreditTransactionType::Earn, 500, '충전');
        $this->creditService->recordTransaction($user, CreditTransactionType::Spend, 200, '사용');

        $overview = $this->creditService->getUserCreditOverview($user);

        $this->assertSame(300, $overview['balance']);
        $this->assertSame(500, $overview['summary']['total_earned']);
        $this->assertSame(200, $overview['summary']['total_used']);
        $this->assertCount(2, $overview['transactions']);
    }

    public function test_check_attendance_rewards_credit_once_per_day(): void
    {
        $user = User::factory()->create();

        $result = $this->creditService->checkAttendance($user);

        $this->assertSame(10, $result['attendance']['reward_amount']);
        $this->assertSame(10, $result['overview']['balance']);
        $this->assertDatabaseHas('moabom_credit_attendances', [
            'user_id' => $user->id,
            'reward_amount' => 10,
        ]);

        $this->expectException(InvalidArgumentException::class);

        $this->creditService->checkAttendance($user);
    }
}
