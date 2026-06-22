<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Http\Requests\Public;

use Illuminate\Foundation\Http\FormRequest;

class GetShellRankingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'limit' => ['sometimes', 'integer', 'min:1', 'max:30'],
        ];
    }

    public function resolvedLimit(): int
    {
        $limit = (int) $this->input('limit', config('moabom-system.shell_rankings.limit', 30));

        return min(30, max(1, $limit));
    }
}
