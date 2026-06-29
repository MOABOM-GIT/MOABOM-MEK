<?php

declare(strict_types=1);

namespace Modules\Moabom\Credit\Tests\Unit;

use App\Models\User;
use InvalidArgumentException;
use Modules\Moabom\Credit\Services\CreditAdminService;
use Modules\Moabom\Credit\Services\CreditService;
use Modules\Moabom\Credit\Tests\ModuleTestCase;

final class CreditAdminServiceTest extends ModuleTestCase
{
    public function test_admin_increase_updates_balance(): void
    {
        $target = User::factory()->create();
        $admin = User::factory()->create();
        $adminService = app(CreditAdminService::class);

        $transaction = $adminService->adjustUserCredit($target, 45, 'increase', '테스트 증가', $admin);

        $this->assertSame(45, $transaction->balance_after);
        $this->assertSame(45, app(CreditService::class)->getUserCreditOverview($target)['balance']);
    }

    public function test_admin_decrease_throws_when_balance_insufficient(): void
    {
        $target = User::factory()->create();
        $admin = User::factory()->create();
        $adminService = app(CreditAdminService::class);

        $this->expectException(InvalidArgumentException::class);
        $adminService->adjustUserCredit($target, 5, 'decrease', null, $admin);
    }
}
