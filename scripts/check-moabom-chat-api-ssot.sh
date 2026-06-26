#!/usr/bin/env bash
# moabom-chat 프로필·채팅 SSOT 라우트·프론트 연결 정합성 (DB/런타임 없이 정적 검사)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="${ROOT}/app/modules/moabom-chat/src/routes/api.php"
CHAT_API="${ROOT}/app/templates/moabom-basic/src/api/moabomChatApi.ts"
PROFILE_API="${ROOT}/app/templates/moabom-basic/src/api/moabomProfileSocialApi.ts"

FAIL=0
fail() { echo "ERROR: $*"; FAIL=1; }
ok()   { echo "    OK: $*"; }

[[ -f "${API}" ]] || { fail "moabom-chat api.php 없음"; exit 1; }

REQUIRED_ROUTES=(
  "Route::get('conversations'"
  "Route::post('conversations'"
  "Route::delete('conversations/{conversationUuid}'"
  "Route::get('conversations/{conversationUuid}/messages'"
  "Route::post('conversations/{conversationUuid}/messages'"
  "Route::get('blocks'"
  "Route::post('blocks'"
  "Route::delete('blocks/{userUuid}'"
  "Route::get('users'"
  "Route::get('users/{userUuid}/eligibility'"
)

for pattern in "${REQUIRED_ROUTES[@]}"; do
  if ! grep -qF "${pattern}" "${API}"; then
    fail "api.php 누락: ${pattern}"
  fi
done

UUID_PATTERN='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
grep -qF "${UUID_PATTERN}" "${API}" \
  || fail "api.php UUID where 패턴 불완전 (5-segment RFC4122 필요)"

if [[ "${FAIL}" -eq 0 ]]; then
  ok "moabom-chat api.php SSOT 라우트 (${#REQUIRED_ROUTES[@]}) + UUID pattern"
fi

[[ -f "${CHAT_API}" ]] || fail "moabomChatApi.ts 없음"
grep -q 'user/conversations/' "${CHAT_API}" || fail "moabomChatApi.ts 에 conversations 경로 없음"
grep -q 'user/blocks' "${CHAT_API}" || fail "moabomChatApi.ts 에 blocks 경로 없음"
grep -q 'user/users/' "${CHAT_API}" || fail "moabomChatApi.ts 에 eligibility 경로 없음"
grep -q 'createTransientShellModuleApi' "${CHAT_API}" \
  || fail "moabomChatApi.ts 가 shell module HTTP SSOT 를 사용하지 않음"

grep -q 'registerMissingUserRoutes' "${ROOT}/app/modules/moabom-chat/src/Providers/ChatServiceProvider.php" \
  || fail "ChatServiceProvider 에 registerMissingUserRoutes 보완 등록 없음"

[[ -f "${PROFILE_API}" ]] || fail "moabomProfileSocialApi.ts 없음"
grep -q "from './moabomChatApi'" "${PROFILE_API}" \
  || fail "moabomProfileSocialApi.ts 가 moabomChatApi SSOT 를 re-export 하지 않음"
grep -q 'user/blocks' "${PROFILE_API}" \
  && fail "moabomProfileSocialApi.ts 에 중복 blocks URL 정의 금지 — moabomChatApi SSOT 사용"

if [[ "${FAIL}" -eq 0 ]]; then
  ok "프론트 chat API SSOT (moabomChatApi ← profileSocial)"
fi

exit "${FAIL}"
