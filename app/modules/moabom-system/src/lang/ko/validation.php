<?php

return [
    /*
     * 사용자 마이페이지 저장 요청(`StoreUserSystemSettingsRequest`) 에서 시스템 옵션 잠금/미지정을
     * 거절할 때 사용하는 메시지(Req 8.1 / 8.2 / 8.4).
     *
     * Req 12 의 iOS UI 미노출 판정은 프론트엔드 전용이므로 본 키셋과는 무관하다.
     */
    'system_option_locked' => '해당 시스템 옵션은 관리자가 잠가 변경할 수 없습니다. (옵션: :id)',
    'system_option_unknown' => '알 수 없는 시스템 옵션입니다. (옵션: :id)',
];
