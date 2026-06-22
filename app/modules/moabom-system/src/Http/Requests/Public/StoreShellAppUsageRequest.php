<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Http\Requests\Public;

use Illuminate\Foundation\Http\FormRequest;

class StoreShellAppUsageRequest extends FormRequest
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
        $maxEvents = (int) config('moabom-system.shell_rankings.max_events_per_request', 20);
        $maxOpenHits = (int) config('moabom-system.shell_rankings.max_open_hits_per_event', 5);
        $maxActiveSeconds = (int) config('moabom-system.shell_rankings.max_active_seconds_per_event', 1800);

        return [
            'events' => ['required', 'array', 'min:1', 'max:'.$maxEvents],
            'events.*.app_id' => ['required', 'string', 'max:128', 'regex:/^[a-z0-9][a-z0-9-]*$/'],
            'events.*.bucket_hour' => ['sometimes', 'nullable', 'date'],
            'events.*.open_hits' => ['sometimes', 'integer', 'min:0', 'max:'.$maxOpenHits],
            'events.*.active_seconds' => ['sometimes', 'integer', 'min:0', 'max:'.$maxActiveSeconds],
        ];
    }
}
