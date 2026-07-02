<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;

/**
 * @deprecated moabom:diagnose:platform-module-layouts --layout=moabom-system.admin_realtime_vm 사용
 */
final class DiagnoseRealtimeVmLayoutCommand extends Command
{
    protected $signature = 'moabom:diagnose:realtime-vm-layout';

    protected $description = 'Realtime VM layout 진단 (→ platform-module-layouts 위임)';

    public function handle(): int
    {
        return $this->call('moabom:diagnose:platform-module-layouts', [
            '--layout' => 'moabom-system.admin_realtime_vm',
        ]);
    }
}
