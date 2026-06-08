<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas\Queue;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Moabom 앱/모듈 큐 잡의 권장 베이스 클래스 (C1).
 *
 * 디스패치 시점의 테넌트 컨텍스트는 TenantQueueBootstrapper 가 페이로드에 자동으로
 * 심고, 워커에서 자동 복원한다. 따라서 이 베이스를 상속하면 별도 코드 없이도
 * 잡이 올바른 tenant DB·GCS·config 위에서 실행된다.
 *
 * 앱 개발 규약: 모듈/플러그인의 큐 잡은 이 클래스를 상속한다(invariant v9-job-tenant).
 * platform 전역 잡(테넌트 무관)이라도 동일 베이스를 쓰면 페이로드 slug=null 로
 * platform 컨텍스트가 보장된다.
 */
abstract class TenantAwareJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use InteractsWithTenant;
    use Queueable;
    use SerializesModels;
}
