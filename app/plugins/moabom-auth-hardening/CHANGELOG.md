# Changelog

이 프로젝트의 모든 주요 변경사항을 기록합니다.
형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따르며,
[Semantic Versioning](https://semver.org/lang/ko/)을 준수합니다.

## [0.2.4] - 2026-05-14

### Changed

- `g7_version`을 `>=7.0.0-beta.1,<8.0.0`로 조정(7.x 전 구간·8.x 메이저 제외)

## [0.2.3] - 2026-05-07

### Changed

- 플랫폼 웹앱의 디바이스 API 사용을 막지 않도록 `Permissions-Policy` 헤더 제거

## [0.2.2] - 2026-05-07

### Changed

- 향후 음성 명령/웹캠 기반 기능을 차단하지 않도록 `Permissions-Policy`에서 `camera`와 `microphone`을 동일 출처에 허용

## [0.2.1] - 2026-05-07

### Fixed

- CSP Report-Only 헤더에서 브라우저가 무시하는 `upgrade-insecure-requests` 지시어 제외
- 날씨 런타임의 브라우저 위치 기능을 막지 않도록 `Permissions-Policy`의 `geolocation`을 `self`로 허용

## [0.2.0] - 2026-05-07

### Added

- 플러그인 표시명을 `Moabom XSS 보안 가드`로 변경하고 전역 보안 플러그인 설명으로 확장
- 콘솔 민감정보 마스킹 추가: 비밀번호, 토큰, 인증 헤더, 이메일, 전화번호 키/문자열 마스킹
- DOM XSS 보조 가드 추가: 동적 inline 이벤트 속성 및 `javascript:`/위험 URL 제거
- Trusted Types 지원 브라우저용 기본 정책 등록
- 서버 보안 응답 헤더 미들웨어 추가: CSP Report-Only, X-Content-Type-Options, Referrer-Policy, Permissions-Policy 등
- 프런트 노출 설정 추가: 콘솔 마스킹, DOM 가드, Trusted Types 가드 토글

### Changed

- password/email/username input 하드닝에서 `name` 자동 생성 제거
- 회원가입/비밀번호 재설정 힌트가 있는 단일 password form도 `new-password`로 추론

## [0.1.0] - 2026-05-07

### Added

- 전역 MutationObserver 기반 password/email/username input 자동 autocomplete 주입
- 순수 함수 `inferPasswordAutocomplete` / `inferUsernameAutocomplete` / `applyAutocompleteHardening`
- 같은 form 내 password 개수 기반 `current-password` vs `new-password` 판별 (1개=로그인, 2개 이상=회원가입/재설정)
- 이미 지정된 `autocomplete` 속성은 존중 (비파괴 주입)
- `data-moa-auth-hardened` 마커를 통한 idempotent 동작 (재스캔 시 중복 처리 skip)
- `requestIdleCallback` 우선 사용, 미지원 환경에서 `setTimeout(0)` 폴백으로 레이아웃 스래싱 완화
- 플러그인 설정 스키마: `enabled`, `login_selector_hint`, `register_selector_hint` (모두 선택)
