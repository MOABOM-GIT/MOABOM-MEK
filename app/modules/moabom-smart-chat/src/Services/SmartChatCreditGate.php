<?php

namespace Modules\Moabom\Smart\Chat\Services;

use App\Models\User;
use InvalidArgumentException;
use Modules\Moabom\Credit\Enums\CreditTransactionType;
use Modules\Moabom\Credit\Services\CreditService;
use Modules\Moabom\Credit\Services\CreditSettingsService;

/**
 * 개인 크레딧 Preflight / Settle.
 * flat 단가 또는 토큰 정밀 과금(P3) + 첨부·웹검색 할증.
 */
class SmartChatCreditGate
{
    public function __construct(
        private readonly CreditSettingsService $settings,
        private readonly CreditService $creditService,
    ) {}

    public function isEnabled(): bool
    {
        return (bool) $this->settings->getSetting('ai_spend.smart_chat_enabled', false);
    }

    public function tokenBillingEnabled(): bool
    {
        return (bool) $this->settings->getSetting('ai_spend.token_billing_enabled', false);
    }

    public function amountPerMessage(): int
    {
        return max(0, (int) $this->settings->getSetting('ai_spend.smart_chat_amount', 0));
    }

    public function attachmentSurcharge(): int
    {
        return max(0, (int) $this->settings->getSetting('ai_spend.attachment_surcharge', 0));
    }

    public function webSearchSurcharge(): int
    {
        return max(0, (int) $this->settings->getSetting('ai_spend.web_search_surcharge', 0));
    }

    public function creditsPer1kPrompt(): int
    {
        return max(0, (int) $this->settings->getSetting('ai_spend.credits_per_1k_prompt', 1));
    }

    public function creditsPer1kCompletion(): int
    {
        return max(0, (int) $this->settings->getSetting('ai_spend.credits_per_1k_completion', 2));
    }

    /**
     * @return array{required: bool, amount: int, balance: int, mode: string}
     */
    public function preflight(User $user, int $attachmentCount = 0, bool $webSearch = false): array
    {
        // 토큰 모드는 사전 정확한 금액을 모름 → flat 하한(또는 최소 1)으로 잔액 확인
        $amount = $this->estimateAmount($attachmentCount, $webSearch, null, null);
        $overview = $this->creditService->getUserCreditOverview($user, 0);
        $balance = (int) ($overview['balance'] ?? 0);

        if ($amount > 0 && $balance < $amount) {
            throw new InvalidArgumentException(__('moabom-credit::messages.insufficient_balance'));
        }

        return [
            'required' => $amount > 0 || ($this->isEnabled() && $this->tokenBillingEnabled()),
            'amount' => $amount,
            'balance' => $balance,
            'mode' => $this->tokenBillingEnabled() ? 'token' : 'flat',
        ];
    }

    /**
     * @param  array<string, mixed>|null  $meta
     */
    public function settle(
        User $user,
        string $sourceId,
        int $attachmentCount = 0,
        bool $webSearch = false,
        ?array $meta = null,
        ?int $promptTokens = null,
        ?int $completionTokens = null,
    ): void {
        $amount = $this->estimateAmount($attachmentCount, $webSearch, $promptTokens, $completionTokens);
        if ($amount <= 0) {
            return;
        }

        $this->creditService->recordTransaction(
            $user,
            CreditTransactionType::Spend,
            $amount,
            __('moabom-smart-chat::messages.credit.spend_description'),
            'ai_smart_chat',
            $sourceId,
            array_merge($meta ?? [], [
                'attachment_count' => $attachmentCount,
                'web_search' => $webSearch,
                'prompt_tokens' => $promptTokens,
                'completion_tokens' => $completionTokens,
                'billing_mode' => $this->tokenBillingEnabled() ? 'token' : 'flat',
            ]),
        );
    }

    private function estimateAmount(
        int $attachmentCount,
        bool $webSearch,
        ?int $promptTokens,
        ?int $completionTokens,
    ): int {
        if (! $this->isEnabled()) {
            return 0;
        }

        $extra = $attachmentCount > 0 ? $this->attachmentSurcharge() : 0;
        $search = $webSearch ? $this->webSearchSurcharge() : 0;
        $surcharge = $extra + $search;

        if ($this->tokenBillingEnabled()) {
            if ($promptTokens !== null || $completionTokens !== null) {
                $p = max(0, (int) ($promptTokens ?? 0));
                $c = max(0, (int) ($completionTokens ?? 0));
                $tokenCost = (int) ceil($p / 1000) * $this->creditsPer1kPrompt()
                    + (int) ceil($c / 1000) * $this->creditsPer1kCompletion();
                // 토큰 0이어도 성공 턴이면 최소 flat 또는 1
                if ($tokenCost <= 0 && ($p + $c) === 0) {
                    $tokenCost = max(1, $this->amountPerMessage());
                }

                return $tokenCost + $surcharge;
            }

            // preflight: flat 하한
            return max($this->amountPerMessage(), 1) + $surcharge;
        }

        return $this->amountPerMessage() + $surcharge;
    }
}
