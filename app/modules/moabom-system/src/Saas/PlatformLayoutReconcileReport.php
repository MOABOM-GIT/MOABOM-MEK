<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

/**
 * platform module layout reconcile 결과 집계.
 */
final class PlatformLayoutReconcileReport
{
    public bool $ok = true;

    /** @var list<string> */
    public array $messages = [];

    /**
     * @var array<string, array{ok: bool, filesystem_version: string, served_version: ?string}>
     */
    public array $layouts = [];

    public function merge(self $other): void
    {
        if (! $other->ok) {
            $this->ok = false;
        }

        array_push($this->messages, ...$other->messages);

        foreach ($other->layouts as $name => $entry) {
            if (! isset($this->layouts[$name])) {
                $this->layouts[$name] = $entry;

                continue;
            }

            if (! $entry['ok']) {
                $this->layouts[$name]['ok'] = false;
            }
        }
    }

    public function addMessage(string $message): void
    {
        $this->messages[] = $message;
    }

    public function addLayoutResult(
        string $canonical,
        bool $layoutOk,
        string $filesystemVersion,
        ?string $servedVersion,
        string $message,
    ): void {
        if (! $layoutOk) {
            $this->ok = false;
        }

        $this->layouts[$canonical] = [
            'ok' => $layoutOk,
            'filesystem_version' => $filesystemVersion,
            'served_version' => $servedVersion,
        ];

        $this->messages[] = $message;
    }
}
