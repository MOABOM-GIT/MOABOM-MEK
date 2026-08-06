<?php

namespace Modules\Moabom\Apps\Services;

use App\Models\User;
use InvalidArgumentException;
use Modules\Moabom\Credit\Enums\CreditTransactionType;
use Modules\Moabom\Credit\Services\CreditService;
use Modules\Moabom\Credit\Services\CreditSettingsService;

/**
 * AI 앱 만들기 생성 1회 과금 — smart-chat 게이트와 동일 패턴, 키만 create_app_*.
 */
class CreateAppCreditGate
{
    public function __construct(
        private readonly CreditSettingsService $settings,
        private readonly CreditService $creditService,
    ) {}

    public function isEnabled(): bool
    {
        return (bool) $this->settings->getSetting('ai_spend.create_app_enabled', false);
    }

    public function amountPerGeneration(): int
    {
        return max(0, (int) $this->settings->getSetting('ai_spend.create_app_amount', 0));
    }

    /**
     * @return array{required: bool, amount: int, balance: int}
     */
    public function preflight(User $user): array
    {
        $amount = $this->isEnabled() ? $this->amountPerGeneration() : 0;
        $overview = $this->creditService->getUserCreditOverview($user, 0);
        $balance = (int) ($overview['balance'] ?? 0);

        if ($amount > 0 && $balance < $amount) {
            throw new InvalidArgumentException(__('moabom-credit::messages.insufficient_balance'));
        }

        return [
            'required' => $amount > 0,
            'amount' => $amount,
            'balance' => $balance,
        ];
    }

    /**
     * @param  array<string, mixed>|null  $meta
     */
    public function settle(User $user, string $sourceId, ?array $meta = null): void
    {
        $amount = $this->isEnabled() ? $this->amountPerGeneration() : 0;
        if ($amount <= 0) {
            return;
        }

        $this->creditService->recordTransaction(
            $user,
            CreditTransactionType::Spend,
            $amount,
            __('moabom-apps::messages.apps.ai.credit.spend_description'),
            'ai_create_app',
            $sourceId,
            $meta,
        );
    }
}
