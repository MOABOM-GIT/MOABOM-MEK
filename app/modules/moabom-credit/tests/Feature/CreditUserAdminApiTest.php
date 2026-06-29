<?php

declare(strict_types=1);

namespace Modules\Moabom\Credit\Tests\Feature;

use App\Enums\ExtensionOwnerType;
use App\Enums\PermissionType;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Modules\Moabom\Credit\Enums\CreditTransactionType;
use Modules\Moabom\Credit\Services\CreditService;
use Modules\Moabom\Credit\Tests\ModuleTestCase;

final class CreditUserAdminApiTest extends ModuleTestCase
{
    private User $adminUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->adminUser = $this->createAdminWithCreditPermissions();
    }

    public function test_user_credits_list_requires_authentication(): void
    {
        $this->getJson('/api/modules/moabom-credit/admin/user-credits')
            ->assertUnauthorized();
    }

    public function test_user_credits_list_returns_users_with_balances(): void
    {
        $target = User::factory()->create(['name' => '크레딧유저']);
        app(CreditService::class)->recordTransaction(
            $target,
            CreditTransactionType::Earn,
            250,
            '테스트 적립',
        );

        $this->actingAs($this->adminUser, 'sanctum')
            ->getJson('/api/modules/moabom-credit/admin/user-credits?search=크레딧유저')
            ->assertOk()
            ->assertJsonPath('data.abilities.can_adjust', true)
            ->assertJsonPath('data.abilities.can_delete', true)
            ->assertJsonFragment([
                'user_id' => $target->id,
                'balance' => 250,
            ]);
    }

    public function test_admin_can_increase_user_credits(): void
    {
        $target = User::factory()->create();

        $this->actingAs($this->adminUser, 'sanctum')
            ->postJson('/api/modules/moabom-credit/admin/user-credits/'.$target->uuid.'/adjust', [
                'direction' => 'increase',
                'amount' => 120,
                'description' => '이벤트 보상',
            ])
            ->assertOk()
            ->assertJsonPath('data.user.balance', 120)
            ->assertJsonPath('data.transaction.amount', 120);
    }

    public function test_admin_can_decrease_user_credits(): void
    {
        $target = User::factory()->create();
        app(CreditService::class)->recordTransaction(
            $target,
            CreditTransactionType::Earn,
            300,
            '초기 적립',
            skipDailyEarnLimit: true,
        );

        $this->actingAs($this->adminUser, 'sanctum')
            ->postJson('/api/modules/moabom-credit/admin/user-credits/'.$target->uuid.'/adjust', [
                'direction' => 'decrease',
                'amount' => 80,
            ])
            ->assertOk()
            ->assertJsonPath('data.user.balance', 220)
            ->assertJsonPath('data.transaction.amount', -80);
    }

    public function test_admin_can_delete_user_credit_data(): void
    {
        $target = User::factory()->create();
        app(CreditService::class)->recordTransaction(
            $target,
            CreditTransactionType::Earn,
            300,
            '초기 적립',
            skipDailyEarnLimit: true,
        );

        $this->actingAs($this->adminUser, 'sanctum')
            ->deleteJson('/api/modules/moabom-credit/admin/user-credits/'.$target->uuid)
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('moabom_credit_balances', ['user_id' => $target->id]);
        $this->assertDatabaseMissing('moabom_credit_transactions', ['user_id' => $target->id]);
    }

    public function test_decrease_rejects_insufficient_balance(): void
    {
        $target = User::factory()->create();

        $this->actingAs($this->adminUser, 'sanctum')
            ->postJson('/api/modules/moabom-credit/admin/user-credits/'.$target->uuid.'/adjust', [
                'direction' => 'decrease',
                'amount' => 10,
            ])
            ->assertStatus(422);
    }

    private function createAdminWithCreditPermissions(): User
    {
        $role = Role::firstOrCreate(
            ['identifier' => 'admin'],
            [
                'name' => ['ko' => '관리자', 'en' => 'Administrator'],
                'description' => ['ko' => '시스템 관리자', 'en' => 'System administrator'],
                'extension_type' => ExtensionOwnerType::Core,
                'extension_identifier' => 'core',
                'is_active' => true,
            ],
        );

        foreach ([
            'core.admin.access',
            'moabom-credit.settings.read',
            'moabom-credit.balances.read',
            'moabom-credit.balances.adjust',
            'moabom-credit.balances.delete',
        ] as $identifier) {
            $permission = Permission::firstOrCreate(
                ['identifier' => $identifier],
                [
                    'name' => ['ko' => $identifier, 'en' => $identifier],
                    'description' => ['ko' => $identifier, 'en' => $identifier],
                    'extension_type' => str_starts_with($identifier, 'moabom-credit')
                        ? ExtensionOwnerType::Module
                        : ExtensionOwnerType::Core,
                    'extension_identifier' => str_starts_with($identifier, 'moabom-credit')
                        ? 'moabom-credit'
                        : 'core',
                    'type' => PermissionType::Admin->value,
                ],
            );
            $role->permissions()->syncWithoutDetaching([$permission->id]);
        }

        $user = User::factory()->create();
        $user->roles()->attach($role->id);

        return $user->fresh(['roles.permissions']);
    }
}
