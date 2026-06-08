<?php

namespace Modules\Moabom\Consulting\Tests\Unit;

use Illuminate\Database\Eloquent\Collection;
use Modules\Moabom\Consulting\Contracts\ContractRepositoryInterface;
use Modules\Moabom\Consulting\Enums\ContractStatus;
use Modules\Moabom\Consulting\Models\Contract;
use Modules\Moabom\Consulting\Services\ContractService;
use Modules\Moabom\Consulting\Services\ProfitabilitySimulationService;
use Modules\Moabom\Consulting\Tests\ModuleTestCase;

class ContractServiceTest extends ModuleTestCase
{
    /**
     * 서명이 있으면 Repository 위임 + 상태 Enum(Signed) + 서버 재계산 결과 저장(C5).
     */
    public function test_create_persists_recalculated_result_and_signed_status_via_repository(): void
    {
        $authoritative = ['marker' => 'server-authoritative'];

        $simulation = $this->createMock(ProfitabilitySimulationService::class);
        $simulation->expects($this->once())
            ->method('simulate')
            ->with(['initial_patients' => 10])
            ->willReturn($authoritative);

        $captured = null;
        $repository = $this->createMock(ContractRepositoryInterface::class);
        $repository->expects($this->once())
            ->method('create')
            ->willReturnCallback(function (array $data) use (&$captured) {
                $captured = $data;

                return new Contract();
            });

        (new ContractService($simulation, $repository))->create(7, [
            'hospital_name' => '모아봄의원',
            'simulation_input' => ['initial_patients' => 10],
            // 클라이언트가 위조한 결과는 무시되어야 한다(C5).
            'simulation_result' => ['marker' => 'client-forged'],
            'signature' => 'data:image/png;base64,AAAA',
        ]);

        $this->assertSame(7, $captured['user_id']);
        $this->assertSame(ContractStatus::Signed, $captured['status']);
        $this->assertSame($authoritative, $captured['simulation_result']);
        $this->assertNotNull($captured['signed_at']);
    }

    /**
     * 서명/입력이 없으면 draft 상태, 시뮬레이션 미실행.
     */
    public function test_create_without_signature_is_draft(): void
    {
        $simulation = $this->createMock(ProfitabilitySimulationService::class);
        $simulation->expects($this->never())->method('simulate');

        $captured = null;
        $repository = $this->createMock(ContractRepositoryInterface::class);
        $repository->method('create')->willReturnCallback(function (array $data) use (&$captured) {
            $captured = $data;

            return new Contract();
        });

        (new ContractService($simulation, $repository))->create(3, ['hospital_name' => 'A의원']);

        $this->assertSame(ContractStatus::Draft, $captured['status']);
        $this->assertNull($captured['signed_at']);
        $this->assertNull($captured['simulation_result']);
    }

    /**
     * 조회는 Repository 로 위임된다(서비스가 직접 모델 쿼리하지 않음).
     */
    public function test_lookups_delegate_to_repository(): void
    {
        $simulation = $this->createMock(ProfitabilitySimulationService::class);
        $repository = $this->createMock(ContractRepositoryInterface::class);
        $repository->expects($this->once())->method('getForUser')->with(7)
            ->willReturn(new Collection());
        $repository->expects($this->once())->method('findForUser')->with(7, 99)
            ->willReturn(null);

        $service = new ContractService($simulation, $repository);
        $service->listForUser(7);

        $this->assertNull($service->findForUser(7, 99));
    }
}
