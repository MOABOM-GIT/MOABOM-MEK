<?php

namespace Modules\Moabom\Social\Auth\Tests\Unit;

use Modules\Moabom\Social\Auth\Exceptions\SocialAuthException;
use Modules\Moabom\Social\Auth\Services\SocialAuthBrokerStateService;
use Modules\Moabom\Social\Auth\Tests\ModuleTestCase;

require_once dirname(__DIR__).'/ModuleTestCase.php';

class SocialAuthBrokerStateServiceTest extends ModuleTestCase
{
    public function test_issue_and_parse_broker_state_round_trip(): void
    {
        putenv('MOABOM_SOCIAL_AUTH_BROKER_ENABLED=true');
        putenv('MOABOM_SOCIAL_AUTH_BROKER_HOST=auth.mek360.com');
        putenv('MOABOM_SOCIAL_AUTH_BROKER_STATE_SECRET=test-broker-secret');
        putenv('MOABOM_SOCIAL_AUTH_BROKER_STATE_TTL=300');
        $_ENV['MOABOM_SOCIAL_AUTH_BROKER_ENABLED'] = 'true';
        $_ENV['MOABOM_SOCIAL_AUTH_BROKER_HOST'] = 'auth.mek360.com';
        $_ENV['MOABOM_SOCIAL_AUTH_BROKER_STATE_SECRET'] = 'test-broker-secret';
        $_ENV['MOABOM_SOCIAL_AUTH_BROKER_STATE_TTL'] = '300';

        $service = app(SocialAuthBrokerStateService::class);
        $token = $service->issueTenantState('freshent.mek360.com', 'google', true);
        $payload = $service->parseTenantState($token, 'google');

        $this->assertSame('freshent.mek360.com', $payload['tenant_host']);
        $this->assertSame('google', $payload['provider']);
        $this->assertTrue($payload['popup']);
    }

    public function test_parse_rejects_tampered_state_token(): void
    {
        putenv('MOABOM_SOCIAL_AUTH_BROKER_ENABLED=true');
        putenv('MOABOM_SOCIAL_AUTH_BROKER_HOST=auth.mek360.com');
        putenv('MOABOM_SOCIAL_AUTH_BROKER_STATE_SECRET=test-broker-secret');
        $_ENV['MOABOM_SOCIAL_AUTH_BROKER_ENABLED'] = 'true';
        $_ENV['MOABOM_SOCIAL_AUTH_BROKER_HOST'] = 'auth.mek360.com';
        $_ENV['MOABOM_SOCIAL_AUTH_BROKER_STATE_SECRET'] = 'test-broker-secret';

        $service = app(SocialAuthBrokerStateService::class);
        $token = $service->issueTenantState('freshent.mek360.com', 'kakao', false);
        $token .= 'tampered';

        $this->expectException(SocialAuthException::class);
        $service->parseTenantState($token, 'kakao');
    }

    public function test_parse_rejects_expired_state_token(): void
    {
        putenv('MOABOM_SOCIAL_AUTH_BROKER_ENABLED=true');
        putenv('MOABOM_SOCIAL_AUTH_BROKER_HOST=auth.mek360.com');
        putenv('MOABOM_SOCIAL_AUTH_BROKER_STATE_SECRET=test-broker-secret');
        putenv('MOABOM_SOCIAL_AUTH_BROKER_STATE_TTL=1');
        $_ENV['MOABOM_SOCIAL_AUTH_BROKER_ENABLED'] = 'true';
        $_ENV['MOABOM_SOCIAL_AUTH_BROKER_HOST'] = 'auth.mek360.com';
        $_ENV['MOABOM_SOCIAL_AUTH_BROKER_STATE_SECRET'] = 'test-broker-secret';
        $_ENV['MOABOM_SOCIAL_AUTH_BROKER_STATE_TTL'] = '1';

        $service = app(SocialAuthBrokerStateService::class);
        $token = $service->issueTenantState('freshent.mek360.com', 'naver', false);

        sleep(2);

        $this->expectException(SocialAuthException::class);
        $service->parseTenantState($token, 'naver');
    }

    public function test_parse_rejects_provider_mismatch(): void
    {
        putenv('MOABOM_SOCIAL_AUTH_BROKER_ENABLED=true');
        putenv('MOABOM_SOCIAL_AUTH_BROKER_HOST=auth.mek360.com');
        putenv('MOABOM_SOCIAL_AUTH_BROKER_STATE_SECRET=test-broker-secret');
        $_ENV['MOABOM_SOCIAL_AUTH_BROKER_ENABLED'] = 'true';
        $_ENV['MOABOM_SOCIAL_AUTH_BROKER_HOST'] = 'auth.mek360.com';
        $_ENV['MOABOM_SOCIAL_AUTH_BROKER_STATE_SECRET'] = 'test-broker-secret';

        $service = app(SocialAuthBrokerStateService::class);
        $token = $service->issueTenantState('freshent.mek360.com', 'google', false);

        $this->expectException(SocialAuthException::class);
        $service->parseTenantState($token, 'kakao');
    }
}

