# Moabom FCM 운영 배선

Firebase Cloud Messaging HTTP v1 — PWA/디바이스 종료 푸시. 실시간 채팅은 Reverb(VM)이며 FCM과 역할이 분리된다.

## Cloud Run env (비시크릿)

`deploy/production.env.yaml` 에 추가 (값은 Firebase 콘솔 기준):

운영 값은 `deploy/production.env.yaml` 의 `# --- Firebase Cloud Messaging` 블록 SSOT.
(웹 apiKey·VAPID 공개 키·projectId 등 비시크릿만. 서비스 계정 JSON 은 Secret Manager.)

## Secret Manager

서비스 계정 JSON 전체는 평문 env 금지.

1. Secret 이름 SSOT: `moabom-fcm-service-account-json` (`deploy/lib/gcp-env.sh` → `SECRET_MOABOM_FCM_SERVICE_ACCOUNT_JSON`)
2. JSON 내용을 Secret Manager 에 저장 후 Cloud Run `MOABOM_FCM_SERVICE_ACCOUNT_JSON` 로 매핑 (`moabom_gcp_secret_mappings`)
3. 부트스트랩: 기존 `deploy/secret-manager-bootstrap.sh` 패턴과 동일하게 시크릿 생성·IAM 부여

## 활성화 체크리스트

1. Firebase 프로젝트 + 웹 앱 + Cloud Messaging API 활성
2. 서비스 계정에 Firebase Cloud Messaging Admin (또는 동등) 권한
3. 플러그인 `moabom-fcm` 활성 + 마이그레이션 (`moabom_fcm_device_tokens`)
4. `moabom-chat` / `sirsoft-board` 업데이트로 알림 정의 fcm 템플릿 sync
5. 관리자: 알림 채널 관리에서 fcm 토글 ON, 알림 발송 이력에서 `channel=fcm` 확인
6. 브라우저: 알림 권한 허용 → `/api/plugins/moabom-fcm/device-tokens` 등록

## 동작 요약

- 로그인 상태와 무관하게 사용자 시스템 알림 옵션이 ON이면 GenericNotification `fcm`을 발송
- Reverb 인앱 토스트와 FCM 시스템 알림은 독립 설정이며 사용자가 둘 다 켤 수 있음
- 무효 토큰(UNREGISTERED 등): DB에서 자동 삭제
- 사용자 OFF는 `notification_logs` status=`skipped`, FCM 미설정·발송 실패는 status=`failed`
