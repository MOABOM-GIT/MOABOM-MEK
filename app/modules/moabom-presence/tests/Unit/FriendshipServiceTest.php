<?php

namespace Modules\Moabom\Presence\Tests\Unit;

use App\Models\User;
use Modules\Moabom\Presence\Contracts\FriendshipRepositoryInterface;
use Modules\Moabom\Presence\Contracts\PresenceUserPreferencesRepositoryInterface;
use Modules\Moabom\Presence\Services\FriendshipService;
use Modules\Moabom\Presence\Services\PresencePresentationService;
use Modules\Moabom\Presence\Services\PresenceRevisionService;
use Modules\Moabom\Presence\Services\TenantOnlineUsersService;
use PHPUnit\Framework\TestCase;

final class FriendshipServiceTest extends TestCase
{
    public function test_send_request_bumps_presence_revision(): void
    {
        $requester = new User(['id' => 10, 'uuid' => '00000000-0000-4000-8000-000000000010']);
        $addressee = new User(['id' => 20, 'uuid' => '00000000-0000-4000-8000-000000000020']);

        $friendships = $this->createMock(FriendshipRepositoryInterface::class);
        $friendships->expects($this->once())
            ->method('findBetween')
            ->with(10, 20)
            ->willReturn(null);
        $friendships->expects($this->once())
            ->method('createRequest')
            ->with(10, 20)
            ->willReturn(new \Modules\Moabom\Presence\Models\Friendship());

        $revisionService = $this->createMock(PresenceRevisionService::class);
        $revisionService->expects($this->once())
            ->method('bump')
            ->with('friendship_requested');

        $service = new FriendshipService(
            $friendships,
            $this->createMock(TenantOnlineUsersService::class),
            $this->createMock(PresenceUserPreferencesRepositoryInterface::class),
            $this->createMock(PresencePresentationService::class),
            $revisionService,
        );

        $service->sendRequest($requester, $addressee);
    }

    public function test_accept_request_bumps_presence_revision(): void
    {
        $viewer = new User(['id' => 20, 'uuid' => '00000000-0000-4000-8000-000000000020']);
        $requester = new User(['id' => 10, 'uuid' => '00000000-0000-4000-8000-000000000010']);

        $existing = new \Modules\Moabom\Presence\Models\Friendship([
            'requester_id' => 10,
            'addressee_id' => 20,
            'status' => \Modules\Moabom\Presence\Enums\FriendshipStatus::Pending,
        ]);
        $existing->setRelation('requester', $requester);
        $existing->setRelation('addressee', $viewer);

        $friendships = $this->createMock(FriendshipRepositoryInterface::class);
        $friendships->expects($this->once())
            ->method('findBetween')
            ->with(20, 10)
            ->willReturn($existing);
        $friendships->expects($this->once())
            ->method('updateStatus')
            ->willReturn($existing);

        $revisionService = $this->createMock(PresenceRevisionService::class);
        $revisionService->expects($this->once())
            ->method('bump')
            ->with('friendship_accepted');

        $service = new FriendshipService(
            $friendships,
            $this->createMock(TenantOnlineUsersService::class),
            $this->createMock(PresenceUserPreferencesRepositoryInterface::class),
            $this->createMock(PresencePresentationService::class),
            $revisionService,
        );

        $service->acceptRequest($viewer, $requester);
    }

    public function test_remove_friendship_bumps_presence_revision_when_pair_deleted(): void
    {
        $viewer = new User(['id' => 10, 'uuid' => '00000000-0000-4000-8000-000000000010']);
        $other = new User(['id' => 20, 'uuid' => '00000000-0000-4000-8000-000000000020']);

        $friendships = $this->createMock(FriendshipRepositoryInterface::class);
        $friendships->expects($this->once())
            ->method('deletePair')
            ->with(10, 20)
            ->willReturn(1);

        $revisionService = $this->createMock(PresenceRevisionService::class);
        $revisionService->expects($this->once())
            ->method('bump')
            ->with('friendship_removed');

        $service = new FriendshipService(
            $friendships,
            $this->createMock(TenantOnlineUsersService::class),
            $this->createMock(PresenceUserPreferencesRepositoryInterface::class),
            $this->createMock(PresencePresentationService::class),
            $revisionService,
        );

        $deleted = $service->removeFriendship($viewer, $other);

        $this->assertSame(1, $deleted);
    }

    public function test_remove_friendship_skips_revision_when_nothing_deleted(): void
    {
        $viewer = new User(['id' => 10]);
        $other = new User(['id' => 20]);

        $friendships = $this->createMock(FriendshipRepositoryInterface::class);
        $friendships->expects($this->once())
            ->method('deletePair')
            ->willReturn(0);

        $revisionService = $this->createMock(PresenceRevisionService::class);
        $revisionService->expects($this->never())->method('bump');

        $service = new FriendshipService(
            $friendships,
            $this->createMock(TenantOnlineUsersService::class),
            $this->createMock(PresenceUserPreferencesRepositoryInterface::class),
            $this->createMock(PresencePresentationService::class),
            $revisionService,
        );

        $this->assertSame(0, $service->removeFriendship($viewer, $other));
    }
}
