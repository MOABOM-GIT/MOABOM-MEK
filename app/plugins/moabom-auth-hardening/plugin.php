<?php

namespace Plugins\Moabom\Auth\Hardening;

use App\Extension\AbstractPlugin;

/**
 * Moabom XSS 보안 가드 플러그인
 *
 * 입력 필드 보안 속성 보정, 콘솔 민감정보 마스킹, DOM XSS 보조 가드,
 * 보안 응답 헤더를 플러그인 범위에서 제공합니다.
 */
class Plugin extends AbstractPlugin
{
    /**
     * 플러그인 메타데이터 반환
     *
     * @return array 메타데이터
     */
    public function getMetadata(): array
    {
        return [
            'author' => 'Moabom',
            'license' => 'MIT',
            'keywords' => ['security', 'xss', 'csp', 'autocomplete', 'hardening'],
        ];
    }

    /**
     * 플러그인 설정 스키마 반환
     *
     * @return array 설정 스키마
     */
    public function getSettingsSchema(): array
    {
        return [
            'enabled' => [
                'type' => 'boolean',
                'default' => true,
                'label' => [
                    'ko' => 'XSS 보안 가드 활성화',
                    'en' => 'Enable XSS Security Guard',
                ],
                'hint' => [
                    'ko' => '비활성화 시 프런트 보안 가드와 보안 응답 헤더를 적용하지 않습니다.',
                    'en' => 'When disabled, frontend guards and security response headers are skipped.',
                ],
                'required' => false,
            ],
            'console_masking_enabled' => [
                'type' => 'boolean',
                'default' => false,
                'label' => [
                    'ko' => '콘솔 민감정보 마스킹',
                    'en' => 'Mask Sensitive Console Data',
                ],
                'hint' => [
                    'ko' => 'console.log/error/warn 등에 포함된 비밀번호, 토큰, 이메일, 연락처를 마스킹합니다.',
                    'en' => 'Masks passwords, tokens, emails, and phone numbers printed through console.log/error/warn.',
                ],
                'required' => false,
            ],
            'dom_guard_enabled' => [
                'type' => 'boolean',
                'default' => false,
                'label' => [
                    'ko' => 'DOM XSS 보조 가드',
                    'en' => 'DOM XSS Guard',
                ],
                'hint' => [
                    'ko' => '동적으로 추가되는 inline 이벤트 속성과 javascript: URL을 제거합니다.',
                    'en' => 'Removes dynamically added inline event attributes and javascript: URLs.',
                ],
                'required' => false,
            ],
            'security_headers_enabled' => [
                'type' => 'boolean',
                'default' => true,
                'label' => [
                    'ko' => '서버 보안 헤더 적용',
                    'en' => 'Apply Security Response Headers',
                ],
                'hint' => [
                    'ko' => 'CSP Report-Only, X-Content-Type-Options, Referrer-Policy 등 기본 보안 헤더를 응답에 추가합니다.',
                    'en' => 'Adds baseline security headers such as CSP Report-Only, X-Content-Type-Options, and Referrer-Policy.',
                ],
                'required' => false,
            ],
            'csp_report_only_enabled' => [
                'type' => 'boolean',
                'default' => true,
                'label' => [
                    'ko' => 'CSP Report-Only 모드',
                    'en' => 'CSP Report-Only Mode',
                ],
                'hint' => [
                    'ko' => '기존 화면 호환성을 위해 기본값은 차단하지 않고 위반 리포트만 남기는 모드입니다.',
                    'en' => 'Defaults to report-only mode to avoid breaking existing screens.',
                ],
                'required' => false,
            ],
            'trusted_types_enabled' => [
                'type' => 'boolean',
                'default' => true,
                'label' => [
                    'ko' => 'Trusted Types 보조 정책',
                    'en' => 'Trusted Types Helper Policy',
                ],
                'hint' => [
                    'ko' => '브라우저가 지원하는 경우 기본 Trusted Types 정책을 등록합니다. CSP 강제는 Report-Only 헤더에서만 안내합니다.',
                    'en' => 'Registers a default Trusted Types policy when supported. Enforcement is only advertised through Report-Only CSP.',
                ],
                'required' => false,
            ],
            'login_selector_hint' => [
                'type' => 'string',
                'default' => '',
                'label' => [
                    'ko' => '추가 로그인 폼 셀렉터 (선택, 쉼표 구분)',
                    'en' => 'Extra login form selectors (optional, comma separated)',
                ],
                'hint' => [
                    'ko' => '일반적으로 비워둡니다. 특정 로그인 폼을 강제로 인식시켜야 할 때만 지정합니다.',
                    'en' => 'Usually left blank. Only specify when forcing recognition of a custom login form.',
                ],
                'required' => false,
            ],
            'register_selector_hint' => [
                'type' => 'string',
                'default' => '',
                'label' => [
                    'ko' => '추가 회원가입 폼 셀렉터 (선택, 쉼표 구분)',
                    'en' => 'Extra register form selectors (optional, comma separated)',
                ],
                'hint' => [
                    'ko' => '일반적으로 비워둡니다. 특정 회원가입 폼을 강제로 인식시켜야 할 때만 지정합니다.',
                    'en' => 'Usually left blank. Only specify when forcing recognition of a custom register form.',
                ],
                'required' => false,
            ],
        ];
    }

    /**
     * 플러그인 설정 기본값 반환
     *
     * @return array 기본 설정값
     */
    public function getConfigValues(): array
    {
        return [
            'enabled' => true,
            'console_masking_enabled' => false,
            'dom_guard_enabled' => false,
            'security_headers_enabled' => true,
            'csp_report_only_enabled' => true,
            'trusted_types_enabled' => true,
            'login_selector_hint' => '',
            'register_selector_hint' => '',
        ];
    }

    /**
     * 플러그인이 제공하는 훅 정보 반환
     *
     * 이 플러그인은 훅을 제공하지 않습니다.
     *
     * @return array 빈 배열
     */
    public function getHooks(): array
    {
        return [];
    }
}
