<?php

namespace Modules\Moabom\Credit\Tests\Feature;

use App\Models\User;
use Modules\Moabom\Credit\Enums\CreditTransactionType;
use Modules\Moabom\Credit\Services\CreditService;
use Modules\Moabom\Credit\Tests\ModuleTestCase;

require_once dirname(__DIR__).'/ModuleTestCase.php';

class CreditApiTest extends ModuleTestCase
{
    private function authHeaders(User $user): array
    {
        return [
            'Authorization' => 'Bearer '.$user->createToken('test-token')->plainTextToken,
            'Accept' => 'application/json',
        ];
    }

    public function test_credits_api_requires_authentication(): void
    {
        $this->getJson('/api/modules/moabom-credit/user/credits')
            ->assertStatus(401);
    }

    public function test_credits_api_returns_empty_overview(): void
    {
        $user = User::factory()->create();

        $this->withHeaders($this->authHeaders($user))
            ->getJson('/api/modules/moabom-credit/user/credits')
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'balance' => 0,
                    'summary' => [
                        'total_earned' => 0,
                        'total_used' => 0,
                        'transaction_count' => 0,
                    ],
                    'transactions' => [],
                ],
            ]);
    }

    public function test_credits_api_returns_balance_and_recent_transactions(): void
    {
        $user = User::factory()->create();
        $creditService = app(CreditService::class);
        $creditService->recordTransaction($user, CreditTransactionType::Earn, 500, '테스트 적립');
        $creditService->recordTransaction($user, CreditTransactionType::Spend, 120, '테스트 사용');

        $this->withHeaders($this->authHeaders($user))
            ->getJson('/api/modules/moabom-credit/user/credits')
            ->assertStatus(200)
            ->assertJsonPath('data.balance', 380)
            ->assertJsonPath('data.summary.total_earned', 500)
            ->assertJsonPath('data.summary.total_used', 120)
            ->assertJsonCount(2, 'data.transactions')
            ->assertJsonPath('data.transactions.0.description', '테스트 사용');
    }

    public function test_attendance_api_rewards_credit_once_per_day(): void
    {
        $user = User::factory()->create();

        $this->withHeaders($this->authHeaders($user))
            ->postJson('/api/modules/moabom-credit/user/attendance')
            ->assertStatus(200)
            ->assertJsonPath('data.attendance.reward_amount', 10)
            ->assertJsonPath('data.overview.balance', 10);

        $this->withHeaders($this->authHeaders($user))
            ->postJson('/api/modules/moabom-credit/user/attendance')
            ->assertStatus(409);
    }
}
