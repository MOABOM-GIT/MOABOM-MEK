<?php

/**
 * AI 생성 앱 HTML 보안 스캔 규칙 SSOT (PHP).
 *
 * 프론트 `generatedAppHtmlSecurity.ts` 와 rule id·패턴을 동기화합니다.
 * 스크립트/CDN 자체는 허용하고, 셸 탈출·쿠키 탈취·난독화 eval 등 악성 의도만 차단합니다.
 */
return [
    'rules' => [
        [
            'id' => 'parent_shell_escape',
            'pattern' => '/(\bparent\s*\.\s*(document|location|window|localStorage|sessionStorage)\b|\btop\s*\.\s*(document|location|window)\b|\bwindow\s*\.\s*(parent|top)\s*\.\s*(document|location)\b|\.frameElement\b)/i',
        ],
        [
            'id' => 'cookie_exfiltration',
            'pattern' => '/(document\s*\.\s*cookie[\s\S]{0,240}?(fetch\s*\(|sendBeacon\s*\(|XMLHttpRequest|\.src\s*=)|(?:fetch\s*\(|sendBeacon\s*\(|XMLHttpRequest)[\s\S]{0,240}?document\s*\.\s*cookie)/i',
        ],
        [
            'id' => 'javascript_protocol',
            'pattern' => '/javascript\s*:/i',
        ],
        [
            'id' => 'insecure_remote_script',
            'pattern' => '/\b(?:src|href)\s*=\s*["\']http:\/\//i',
        ],
        [
            'id' => 'obfuscated_eval',
            'pattern' => '/\b(?:eval|new\s+Function)\s*\(\s*(?:atob|unescape|decodeURIComponent)\s*\(/i',
        ],
        [
            'id' => 'meta_refresh',
            'pattern' => '/<meta\b[^>]*http-equiv\s*=\s*["\']refresh["\'][^>]*>/i',
        ],
        [
            'id' => 'data_html_iframe',
            'pattern' => '/<iframe\b[^>]*\bsrc\s*=\s*["\']data\s*:\s*text\/html/i',
        ],
    ],
];
