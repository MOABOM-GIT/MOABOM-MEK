<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Modules\Moabom\System\Saas\PlatformRuntimeConfigurator;
use Modules\Moabom\System\Saas\SaasAdminCredentials;

/**
 * E2E·smoke — platform(mek360) DB context에서 Sanctum admin token 발급.
 */
class SaasPlatformAdminTokenCommand extends Command
{
    protected $signature = 'moabom:saas:platform-admin-token
        {--email=admin@mek360.com : admin 사용자 email}';

    protected $description = '플랫폼 DB admin Sanctum token (E2E·smoke)';

    public function handle(PlatformRuntimeConfigurator $platformRuntimeConfigurator): int
    {
        $email = SaasAdminCredentials::email((string) $this->option('email'));
        $platformRuntimeConfigurator->applyPlatform();

        $user = User::query()->where('email', $email)->first();
        if ($user === null) {
            $this->error("platform DB admin 없음: {$email}");

            return self::FAILURE;
        }

        $this->line($user->createToken('saas-platform-admin-token')->plainTextToken);

        return self::SUCCESS;
    }
}
