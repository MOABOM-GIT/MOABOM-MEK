<?php

namespace Modules\Moabom\Smart\Chat\Services;

use App\Models\User;
use Modules\Moabom\Smart\Chat\Models\SmartChatPreference;

class SmartChatPreferenceService
{
    /**
     * @return list<string>
     */
    public function defaultEnabledTools(): array
    {
        return array_values(array_filter(
            (array) config('moabom-smart-chat.tools.default_enabled', SmartChatSiteToolService::ALL_TOOLS),
            static fn ($v) => is_string($v) && $v !== ''
        ));
    }

    public function getCustomInstructions(User $user): string
    {
        $row = SmartChatPreference::query()->where('user_id', $user->id)->first();

        return trim((string) ($row?->custom_instructions ?? ''));
    }

    /**
     * @return array{custom_instructions: string, enabled_tools: list<string>, web_search_enabled: bool}
     */
    public function getAll(User $user): array
    {
        $row = SmartChatPreference::query()->where('user_id', $user->id)->first();
        $tools = is_array($row?->enabled_tools) ? $row->enabled_tools : null;

        return [
            'custom_instructions' => trim((string) ($row?->custom_instructions ?? '')),
            'enabled_tools' => $this->normalizeTools($tools),
            'web_search_enabled' => (bool) ($row?->web_search_enabled ?? false),
        ];
    }

    /**
     * @return array{enabled_tools: list<string>, web_search_enabled: bool}
     */
    public function getFlags(User $user): array
    {
        $all = $this->getAll($user);

        return [
            'enabled_tools' => $all['enabled_tools'],
            'web_search_enabled' => $all['web_search_enabled'],
        ];
    }

    /**
     * @param  array{custom_instructions?: string|null, enabled_tools?: list<string>|null, web_search_enabled?: bool|null}  $input
     * @return array{custom_instructions: string, enabled_tools: list<string>, web_search_enabled: bool}
     */
    public function save(User $user, array $input): array
    {
        $current = $this->getAll($user);

        if (array_key_exists('custom_instructions', $input)) {
            $text = trim((string) ($input['custom_instructions'] ?? ''));
            $max = (int) config('moabom-smart-chat.preferences.max_instructions_chars', 4000);
            if (mb_strlen($text) > $max) {
                $text = mb_substr($text, 0, $max);
            }
            $current['custom_instructions'] = $text;
        }

        if (array_key_exists('enabled_tools', $input)) {
            $current['enabled_tools'] = $this->normalizeTools(
                is_array($input['enabled_tools']) ? $input['enabled_tools'] : []
            );
        }

        if (array_key_exists('web_search_enabled', $input)) {
            $current['web_search_enabled'] = (bool) $input['web_search_enabled'];
        }

        SmartChatPreference::query()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'custom_instructions' => $current['custom_instructions'] !== ''
                    ? $current['custom_instructions']
                    : null,
                'enabled_tools' => $current['enabled_tools'],
                'web_search_enabled' => $current['web_search_enabled'],
            ],
        );

        return $current;
    }

    /**
     * @param  list<mixed>|null  $tools
     * @return list<string>
     */
    private function normalizeTools(?array $tools): array
    {
        if ($tools === null) {
            return $this->defaultEnabledTools();
        }

        $allow = (array) config('moabom-smart-chat.tools.site_allowlist', SmartChatSiteToolService::ALL_TOOLS);
        $out = [];
        foreach ($tools as $t) {
            if (! is_string($t)) {
                continue;
            }
            $key = strtolower(trim($t));
            if (in_array($key, $allow, true)) {
                $out[] = $key;
            }
        }

        return array_values(array_unique($out));
    }
}
