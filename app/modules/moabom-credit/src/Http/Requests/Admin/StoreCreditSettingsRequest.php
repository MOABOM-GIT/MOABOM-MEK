<?php

namespace Modules\Moabom\Credit\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class StoreCreditSettingsRequest extends FormRequest
{
    /**
     * 요청 권한을 확인합니다.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * 검증 규칙을 반환합니다.
     *
     * @return array<string, string>
     */
    public function rules(): array
    {
        return [
            'rewards' => 'required|array',
            'rewards.login_enabled' => 'boolean',
            'rewards.login_amount' => 'integer|min:0|max:1000000',
            'rewards.post_write_enabled' => 'boolean',
            'rewards.post_write_amount' => 'integer|min:0|max:1000000',
            'rewards.like_received_enabled' => 'boolean',
            'rewards.like_received_amount' => 'integer|min:0|max:1000000',
            'rewards.comment_write_enabled' => 'boolean',
            'rewards.comment_write_amount' => 'integer|min:0|max:1000000',
            'rewards.app_review_write_enabled' => 'boolean',
            'rewards.app_review_write_amount' => 'integer|min:0|max:1000000',
            'rewards.attendance_enabled' => 'boolean',
            'rewards.attendance_amount' => 'integer|min:1|max:1000000',
            'limits' => 'required|array',
            'limits.daily_earn_limit' => 'integer|min:0|max:100000000',
            'limits.attendance_daily_limit' => 'integer|min:1|max:10',
            'limits.max_post_write_rewards_per_day' => 'integer|min:0|max:1000',
            'limits.max_like_received_rewards_per_day' => 'integer|min:0|max:10000',
            'limits.max_comment_write_rewards_per_day' => 'integer|min:0|max:1000',
            'limits.max_app_review_write_rewards_per_day' => 'integer|min:0|max:1000',
            'ads' => 'required|array',
            'ads.attendance_requires_ad' => 'boolean',
            'ads.attendance_ad_provider' => 'nullable|string|in:google,none',
            'ads.attendance_ad_reward_multiplier' => 'numeric|min:1|max:10',
            'levels' => 'required|array',
            'levels.thresholds' => 'required|array|size:10',
            'levels.thresholds.*' => 'integer|min:0|max:100000000',
            'ai_spend' => 'required|array',
            'ai_spend.smart_chat_enabled' => 'boolean',
            'ai_spend.smart_chat_amount' => 'integer|min:0|max:1000000',
            'ai_spend.create_app_enabled' => 'boolean',
            'ai_spend.create_app_amount' => 'integer|min:0|max:1000000',
            'ai_spend.attachment_surcharge' => 'integer|min:0|max:1000000',
            'ai_spend.web_search_surcharge' => 'integer|min:0|max:1000000',
            'ai_spend.token_billing_enabled' => 'boolean',
            'ai_spend.credits_per_1k_prompt' => 'integer|min:0|max:1000000',
            'ai_spend.credits_per_1k_completion' => 'integer|min:0|max:1000000',
        ];
    }

    /**
     * @return void
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $thresholds = $this->input('levels.thresholds');
            if (! is_array($thresholds) || count($thresholds) !== 10) {
                return;
            }

            $prev = null;
            foreach (array_values($thresholds) as $index => $value) {
                if (! is_numeric($value)) {
                    continue;
                }
                $current = (int) $value;
                if ($index === 0 && $current !== 0) {
                    $validator->errors()->add('levels.thresholds.0', 'Lv.1 threshold must be 0.');
                }
                if ($prev !== null && $current < $prev) {
                    $validator->errors()->add(
                        'levels.thresholds.'.$index,
                        'Level thresholds must be non-decreasing.',
                    );
                    break;
                }
                $prev = $current;
            }
        });
    }

    /**
     * 저장할 설정 배열을 반환합니다.
     *
     * @return array<string, mixed>
     */
    public function validatedSettings(): array
    {
        return $this->validated();
    }
}
