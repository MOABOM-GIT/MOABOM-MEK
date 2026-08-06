#!/usr/bin/env bash
# Reverb publish · Cloud Tasks queue · FCM/알림 선언 운영 스모크.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=lib/cloud-run-artisan-job.sh
source deploy/lib/cloud-run-artisan-job.sh

bash deploy/check-realtime-vm-health.sh
bash deploy/check-runtime-plane-image-parity.sh
moabom_run_artisan_job moabom-queue-plane-probe 180s \
  moabom:queue:probe --timeout=60 --no-interaction >/dev/null

JOB_NAME="moabom-realtime-notification-smoke"
PHP_CODE='
$fail = 0;
$expected = [
    "friend_request" => "moabom-presence",
    "friend_accepted" => "moabom-presence",
    "reply_comment" => "sirsoft-board",
    "post_reply" => "sirsoft-board",
    "chat_message" => "moabom-chat",
];

foreach ($expected as $type => $extension) {
    $definition = \App\Models\NotificationDefinition::query()
        ->with("templates")
        ->where("type", $type)
        ->where("extension_identifier", $extension)
        ->first();
    $channels = is_array($definition?->channels) ? $definition->channels : [];
    $templateChannels = $definition?->templates->pluck("channel")->all() ?? [];
    $ready = $definition !== null
        && in_array("database", $channels, true)
        && in_array("fcm", $channels, true)
        && in_array("database", $templateChannels, true)
        && in_array("fcm", $templateChannels, true);
    echo ($ready ? "SMOKE_OK" : "SMOKE_FAIL")
        ." definition {$extension}:{$type} channels=".implode(",", $channels)
        ." templates=".implode(",", $templateChannels).PHP_EOL;
    if (! $ready) { $fail = 1; }
}

$fcmReady = app(\Plugins\Moabom\Fcm\Services\FcmPushService::class)->isEnabled();
echo ($fcmReady ? "SMOKE_OK" : "SMOKE_FAIL")." fcm readiness".PHP_EOL;
if (! $fcmReady) { $fail = 1; }

$jobsTable = (string) config("queue.connections.database.table", "jobs");
$probeRows = \Illuminate\Support\Facades\DB::table($jobsTable)
    ->where("queue", "realtime-probe")
    ->count();
echo ($probeRows === 0 ? "SMOKE_OK" : "SMOKE_FAIL")
    ." realtime-probe pending={$probeRows}".PHP_EOL;
if ($probeRows !== 0) { $fail = 1; }

$staleEligible = \Illuminate\Support\Facades\DB::table($jobsTable)
    ->where("available_at", "<=", now()->subMinutes(5)->getTimestamp())
    ->count();
echo ($staleEligible === 0 ? "SMOKE_OK" : "SMOKE_FAIL")
    ." stale queue jobs={$staleEligible}".PHP_EOL;
if ($staleEligible !== 0) { $fail = 1; }

echo $fail === 0 ? "SMOKE_RESULT PASSED" : "SMOKE_RESULT FAILED";
echo PHP_EOL;
'

PHP_B64="$(printf '%s' "${PHP_CODE}" | base64 -w0)"
exec_name="$(moabom_run_artisan_job "${JOB_NAME}" 300s \
  tinker --execute="eval(base64_decode(\"${PHP_B64}\"));")"
logs="$(gcloud logging read \
  "resource.type=\"cloud_run_job\"
   resource.labels.job_name=\"${JOB_NAME}\"
   labels.\"run.googleapis.com/execution_name\"=\"${exec_name}\"" \
  --project="${MOABOM_CRJ_PROJECT}" \
  --limit=100 \
  --format='value(textPayload)' | tac)"

echo "${logs}" | grep -E '^SMOKE_' || true
if ! echo "${logs}" | grep -q 'SMOKE_RESULT PASSED'; then
  echo "== smoke-realtime-notifications FAILED ==" >&2
  exit 1
fi
echo "== smoke-realtime-notifications PASSED =="
