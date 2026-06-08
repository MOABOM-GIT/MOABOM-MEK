<?php

namespace Modules\Moabom\Social\Auth\Exceptions;

use RuntimeException;

class SocialAuthException extends RuntimeException
{
    /**
     * 지원하지 않는 제공자 예외를 생성합니다.
     */
    public static function unsupportedProvider(string $provider): self
    {
        return new self(__('moabom-social-auth::messages.unsupported_provider', ['provider' => $provider]));
    }

    /**
     * 제공자 설정 누락 예외를 생성합니다.
     */
    public static function missingConfig(string $provider): self
    {
        return new self(__('moabom-social-auth::messages.missing_config', ['provider' => $provider]));
    }

    /**
     * 이메일이 없는 계정 예외를 생성합니다.
     */
    public static function emailRequired(string $provider): self
    {
        return new self(__('moabom-social-auth::messages.email_required', ['provider' => $provider]));
    }
}
