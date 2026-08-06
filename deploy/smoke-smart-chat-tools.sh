#!/usr/bin/env bash
# 스마트챗 도구 스모크 — 운영 이미지·운영 DB 기준 function calling 도구의 실제 결과 검증 (읽기 전용).
#
# 정적 검증으로 잡히지 않는 데이터 plane 불일치(빈 테넌트 잔재 테이블, 셸 ID 캐스팅 등)를
# 배포 후 즉시 잡기 위한 게이트. LLM 호출 없이 도구 실행기만 검증한다.
#
# 사용: bash deploy/smoke-smart-chat-tools.sh
set -euo pipefail
cd "$(dirname "$0")/.."
source deploy/lib/cloud-run-artisan-job.sh

JOB_NAME="moabom-smart-chat-tool-smoke"

PHP_CODE='
$fail = 0;
$u = \App\Models\User::query()->orderBy("id")->first();
$reg = app(\Modules\Moabom\Smart\Chat\Services\SmartChatToolRegistry::class);

$specs = $reg->functionSpecs(false);
$names = array_map(fn ($s) => $s["name"], $specs);
echo (count($specs) >= 5 ? "SMOKE_OK" : "SMOKE_FAIL")." specs count=".count($specs)." [".implode(",", $names)."]".PHP_EOL;
if (count($specs) < 5) { $fail = 1; }

// 인기 앱 — 항목 존재 + 제목이 하나라도 매칭돼야 함 (빈 제목 전멸 = plane/ID 결함)
$apps = $reg->executeFunction($u, "get_popular_apps", ["limit" => 10]);
$items = is_array($apps["items"] ?? null) ? $apps["items"] : [];
$titled = array_filter($items, fn ($i) => trim((string) ($i["title"] ?? "")) !== "" && (string) ($i["title"] ?? "") !== "Array");
// 셸 ID 가 제목으로 그대로 나온 항목(레지스트리·생성앱 어디에도 없는 잔재)은 있어도 되지만,
// 해석된 제목이 하나도 없으면 plane/ID/i18n 결함
$resolved = array_filter($items, fn ($i) => (string) ($i["title"] ?? "") !== (string) ($i["app_id"] ?? "") && trim((string) ($i["title"] ?? "")) !== "" && (string) ($i["title"] ?? "") !== "Array");
if ($items === [] || $resolved === []) { $fail = 1; echo "SMOKE_FAIL popular_apps items=".count($items)." titled=".count($titled)." resolved=".count($resolved).PHP_EOL; }
else { echo "SMOKE_OK popular_apps items=".count($items)." titled=".count($titled)." resolved=".count($resolved)." top=".((string) ($items[0]["title"] ?? "")).PHP_EOL; }

// 데이터 카탈로그 apps — 공개 스코프에서 행이 나와야 함
$dq = $reg->executeFunction($u, "query_platform_data", ["resource" => "apps", "limit" => 5]);
$rows = (int) ($dq["row_count"] ?? 0);
if (isset($dq["error"]) || $rows < 1) { $fail = 1; echo "SMOKE_FAIL data_query_apps rows=".$rows." error=".json_encode($dq["error"] ?? null).PHP_EOL; }
else { echo "SMOKE_OK data_query_apps rows=".$rows.PHP_EOL; }

// like 부분일치 — 실제 앱 제목의 앞 2글자로 검색해 1행 이상 나와야 함 (% 자동 래핑 검증)
$firstTitle = (string) ($dq["rows"][0]["title"] ?? "");
if ($firstTitle !== "") {
    $needle = mb_substr($firstTitle, 0, 2);
    $like = $reg->executeFunction($u, "query_platform_data", ["resource" => "apps", "filters" => [["column" => "title", "op" => "like", "value" => $needle]], "limit" => 5]);
    $likeRows = (int) ($like["row_count"] ?? 0);
    if ($likeRows < 1) { $fail = 1; echo "SMOKE_FAIL like_search needle=".$needle." rows=".$likeRows.PHP_EOL; }
    else { echo "SMOKE_OK like_search needle=".$needle." rows=".$likeRows.PHP_EOL; }
}

// 내 크레딧 — balance 키 존재
$credit = $reg->executeFunction($u, "get_my_credit", []);
if (! array_key_exists("balance", $credit)) { $fail = 1; echo "SMOKE_FAIL credit keys=".implode(",", array_keys($credit)).PHP_EOL; }
else { echo "SMOKE_OK credit balance=".$credit["balance"].PHP_EOL; }

// 프로필 — 닉네임/이름 존재
$profile = $reg->executeFunction($u, "get_my_profile", []);
if (! isset($profile["nickname"]) && ! isset($profile["name"])) { $fail = 1; echo "SMOKE_FAIL profile".PHP_EOL; }
else { echo "SMOKE_OK profile".PHP_EOL; }

// 게시판 카탈로그 — 오류 없이 실행
$board = $reg->executeFunction($u, "query_platform_data", ["resource" => "board_posts", "aggregates" => [["fn" => "count", "column" => "*"]]]);
if (isset($board["error"])) { $fail = 1; echo "SMOKE_FAIL board_posts error=".json_encode($board["error"]).PHP_EOL; }
else { echo "SMOKE_OK board_posts".PHP_EOL; }

echo $fail === 0 ? "SMOKE_RESULT PASSED" : "SMOKE_RESULT FAILED";
echo PHP_EOL;
'

PHP_B64="$(printf '%s' "${PHP_CODE}" | base64 -w0)"
exec_name="$(moabom_run_artisan_job "${JOB_NAME}" 300s tinker --execute="eval(base64_decode(\"${PHP_B64}\"));")"

logs="$(gcloud logging read \
  "resource.type=\"cloud_run_job\"
   resource.labels.job_name=\"${JOB_NAME}\"
   labels.\"run.googleapis.com/execution_name\"=\"${exec_name}\"" \
  --project="${MOABOM_CRJ_PROJECT}" \
  --limit=100 \
  --format='value(textPayload)' | tac)"

echo "${logs}" | grep -E '^SMOKE_' || true

if ! echo "${logs}" | grep -q 'SMOKE_RESULT PASSED'; then
  echo "== smoke-smart-chat-tools FAILED ==" >&2
  exit 1
fi
echo "== smoke-smart-chat-tools PASSED =="
