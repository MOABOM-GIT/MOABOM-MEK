export type MysumSectionKey =
  | 'agenda'
  | 'systems'
  | 'data'
  | 'connect'
  | 'access'
  | 'ai-apps';

export type MysumBlock = {
  id: string;
  title: string;
  icon?: string;
  body?: string;
  bullets?: string[];
  table?: { headers: string[]; rows: string[][] };
  code?: string;
  sides?: {
    mysum: { title?: string; bullets: string[] };
    moabom: { title?: string; bullets: string[] };
  };
  callout?: { tone: 'decided' | 'info' | 'action'; text: string };
};

export type MysumSection = {
  title: string;
  lead?: string;
  blocks: MysumBlock[];
};

/**
 * 마이숨 ↔ 스마트케어360 연동 — 개발자 회의용 브리프.
 * 발표 자료: 데이터 계약 · 연동 방식 · 인증 흐름 · 양측 할 일.
 */
export const MYSUM_SECTIONS: Record<MysumSectionKey, MysumSection> = {
  agenda: {
    title: '안건 · 합의 포인트',
    lead: '마이숨 원장(환자·계약·장비)을 스마트케어360 대시보드·앱·AI 생성 앱에서 안전하게 쓰기 위한 연동 방향을, 개발자 기준으로 맞춥니다.',
    blocks: [
      {
        id: 'a0',
        title: '이 자료의 목적',
        icon: 'clipboard-list',
        callout: {
          tone: 'info',
          text: '구현 스펙 확정이 아니라, 양측이 같은 말로 API·권한·할 일을 맞추기 위한 회의 브리프입니다. 탭 순서대로 보면 됩니다.',
        },
        bullets: [
          '01 역할·시스템 — 누가 원장이고, 우리 인프라는 무엇인지',
          '02 데이터 정의 — 필드 사전·네이밍·기간 필터 (연동의 핵심)',
          '03 연동·할 일 — API/웹훅과 양측 작업',
          '04 접근 경계 — 토큰·Secret Manager·역할 permission 원라인',
          '05 AI 앱 — API 오픈 후 바로 붙는 활용',
        ],
      },
      {
        id: 'a2',
        title: '전제 (이미 합의)',
        icon: 'check-circle',
        callout: {
          tone: 'decided',
          text: '환자 · 계약 · 장비의 SSOT는 마이숨입니다. 스마트케어360은 그 데이터를 소비하는 플랫폼입니다. 분석 CRM은 읽기 전용만.',
        },
      },
      {
        id: 'a3',
        title: '오늘 맞출 체크리스트',
        icon: 'flag',
        bullets: [
          '□ 필드 사전 · 네이밍 · MVP 필요 범위',
          '□ HTTPS API + (가능 시) 웹훅',
          '□ 기간 필터 (date_from / date_to / updated_since)',
          '□ 인증 2층: 마이숨 파트너 토큰(서버) + 플랫폼 로그인·역할(사람)',
          '□ MVP: 환자·임대 조회 + AS 접수 쓰기 1건',
          '□ 샌드박스 E2E 일정 감각',
        ],
      },
      {
        id: 'a3b',
        title: '마이숨 측에 확인할 질문',
        icon: 'comments',
        bullets: [
          '1. 파트너 토큰은 Bearer인가, JWT인가? (헤더·만료)',
          '2. 토큰 scope(읽기/쓰기/병원 범위)는 어떻게 주나?',
          '3. IP allowlist · 만료 · 로테이션 정책은?',
        ],
      },
      {
        id: 'a4',
        title: '다음 액션',
        icon: 'bullseye',
        table: {
          headers: ['담당', '액션', '산출물'],
          rows: [
            ['양측', '필드 매핑 워크숍', '환자/임대/장비/AS 필드 사전'],
            ['마이숨', 'API·토큰·방화벽 초안', '엔드포인트 표 또는 OpenAPI'],
            ['스마트케어360', '프록시 · permission · 웹훅 수신', '역할 매핑 + Secret Manager'],
            ['양측', '샌드박스 E2E', '조회 1 + 쓰기 1 + 기간 필터 1'],
          ],
        },
      },
    ],
  },

  systems: {
    title: '역할 · 시스템',
    lead: '원장과 활용 표면을 나누고, 양측 런타임을 공유합니다.',
    blocks: [
      {
        id: 's1',
        title: '시스템 역할',
        icon: 'sitemap',
        table: {
          headers: ['시스템', '담당', '역할'],
          rows: [
            ['마이숨 (DX)', '환자·처방·임대·회수·AS·정산', 'ERP 원장 / SSOT'],
            ['스마트케어360', '테넌트 앱·대시보드·실시간 UX', '활용 표면 · 제한된 쓰기'],
            ['분석 CRM (MetaM 등)', '캠페인·퍼널', '읽기 전용 (원장 덮어쓰기 금지)'],
          ],
        },
        body: '원장 변경 → API 조회 또는 웹훅 → 플랫폼 반영 → 테넌트 앱·대시보드.',
      },
      {
        id: 's2',
        title: '마이숨 환경 (확인)',
        icon: 'server',
        table: {
          headers: ['항목', '현황', '연동 시 확인'],
          rows: [
            ['앱', 'PHP · 그누보드5', '커스텀 모듈 · 노출 도메인'],
            ['인프라', '네이버클라우드', '공인 IP · 방화벽 · SSL'],
            ['DB', 'MySQL', 'API로 열 범위 (원장 DB 직접 노출 금지)'],
            ['인증', '세션 · 관리자', '파트너용 API 토큰'],
          ],
        },
      },
      {
        id: 's3',
        title: '스마트케어360 구성',
        icon: 'layer-group',
        body: 'Cloud Run은 요청 기반(스케일 투 제로)이라 Redis·Reverb는 Realtime VM에서 상시 가동합니다. 외부 진입은 GCP 로드 밸런서가 단일 창구입니다.',
        table: {
          headers: ['계층', '구성'],
          rows: [
            ['진입', 'GCP 로드 밸런서 (LB) — HTTPS · 테넌트 Host'],
            ['프론트', '앱 셸 (React) · 테넌트별 창'],
            ['백엔드', 'Laravel · G7 · moabom-* · Sanctum → Cloud Run'],
            ['데이터', 'Cloud SQL · GCS'],
            ['실시간 VM', 'Redis · Reverb (WebSocket)'],
          ],
        },
      },
    ],
  },

  data: {
    title: '데이터 정의 · API 계약',
    lead: '연동의 핵심입니다. 무엇을·어떤 이름으로·어떤 필터로 넘길지를 맞춥니다. 마이숨 내부 테이블은 구현 영역이고, 합의 대상은 API 응답입니다.',
    blocks: [
      {
        id: 'd0',
        title: '맞출 계약 단위',
        icon: 'book',
        table: {
          headers: ['항목', '의미', '산출물'],
          rows: [
            ['필드 사전', '엔티티별 필드·의미·필수 여부', '환자/임대/장비/AS 표'],
            ['API 응답 스키마', 'JSON 필드명·타입·포맷', 'OpenAPI / 샘플 JSON'],
            ['네이밍 규약', '필드·ID·날짜·상태 표기', 'snake_case, ISO 8601'],
            ['필요 범위', '360이 실제로 쓸 필드만', 'MVP 필수 / 2차 후보'],
            ['조회·필터 API', '기간·상태·증분 조회', 'date_from, updated_since'],
          ],
        },
      },
      {
        id: 'd1',
        title: '엔티티 초안 (마이숨 → 플랫폼)',
        icon: 'database',
        body: '회의용 초안입니다. 워크숍에서 필수/제외를 확정합니다. 360 필요: 식별자·상태·핵심 일자·기간 필터 가능한 목록 · AS 쓰기 최소 필드. 원장 전체 복제·불필요 PII는 제외.',
        table: {
          headers: ['엔티티', '가져올 정보 (예시)', '비고'],
          rows: [
            ['환자', 'patient_id, hospital_code, 성명(마스킹 가능), 연락처(최소), 상태, updated_at', '주민번호 등 제외'],
            ['계약·임대', 'rental_id, patient_id, status, 시작·종료·회수예정일, device_id', '회수 목록 핵심'],
            ['장비', 'device_id, 모델·시리얼, status, 연결 환자/임대, 점검·교체일', '현황·이력'],
            ['AS', 'ticket_id, patient/device_id, 유형·상태, 접수·처리 시각, 요약', '조회 + POST 접수'],
          ],
        },
      },
      {
        id: 'd3',
        title: '네이밍 규약 (초안)',
        icon: 'font',
        table: {
          headers: ['항목', '규약', '예'],
          rows: [
            ['필드명', 'snake_case', 'patient_id, rental_status'],
            ['ID', '마이숨 원장 ID 문자열 유지 (360이 재발급하지 않음)', '"P-10293"'],
            ['날짜·시각', 'ISO 8601 · 타임존 명시', '2026-07-11T09:00:00+09:00'],
            ['상태', '영문 enum + 문서화', 'active / due / returned'],
            ['병원', 'hospital_code ↔ tenant 매핑', 'hospital_code'],
            ['증분', 'updated_at + updated_since', '변경분만 동기화'],
          ],
        },
      },
      {
        id: 'd4',
        title: '기간·필터 API (필수)',
        icon: 'calendar',
        callout: {
          tone: 'action',
          text: '날짜별 조회 = 목록 API에 기간 파라미터가 있어야 합니다. 전체 dump 후 360에서만 거르는 방식은 비권장입니다.',
        },
        table: {
          headers: ['파라미터', '용도'],
          rows: [
            ['date_from / date_to', '기간 (회수예정·접수·시작일 등)'],
            ['date_field', '기준 날짜 컬럼 (due_date | started_at | created_at)'],
            ['updated_since', '증분 동기화'],
            ['status', '상태 필터'],
            ['page / per_page', '페이지네이션'],
          ],
        },
        code: `GET /api/v1/patients?hospital_code=&q=&updated_since=&page=
GET /api/v1/rentals?hospital_code=&status=&date_field=due_date&date_from=&date_to=&page=
GET /api/v1/devices?hospital_code=&status=&updated_since=&page=
GET /api/v1/as-tickets?hospital_code=&date_from=&date_to=&status=&page=
POST /api/v1/as-tickets

# 예: 7월 회수 예정
GET /api/v1/rentals?status=due&date_field=due_date&date_from=2026-07-01&date_to=2026-07-31`,
      },
      {
        id: 'd5',
        title: '산출물',
        icon: 'file-lines',
        sides: {
          mysum: {
            title: '마이숨',
            bullets: [
              '필드 사전 (필수/선택/제외)',
              '샘플 JSON · OpenAPI',
              '필터·enum·타임존 명시',
            ],
          },
          moabom: {
            title: '스마트케어360',
            bullets: [
              '화면별 필요 필드 (MVP/2차)',
              'hospital_code ↔ tenant',
              '프록시 PII 마스킹',
            ],
          },
        },
      },
    ],
  },

  connect: {
    title: '연동 방식 · 할 일',
    lead: '원장 DB를 직접 열지 않고, 합의된 HTTPS API로 연결합니다. 인증·권한 상세 흐름은 다음 탭(접근 경계)에 있습니다.',
    blocks: [
      {
        id: 'c0',
        title: '권장 조합',
        icon: 'diagram-project',
        callout: {
          tone: 'action',
          text: '기본 = HTTPS API(토큰). 보완 = 원장 변경 웹훅. 병원코드 ↔ tenant 매핑.',
        },
        table: {
          headers: ['방식', '용도', '비고'],
          rows: [
            ['HTTPS API', '조회 · 쓰기 · 버전 관리', '권장 기본선'],
            ['웹훅', '변경 즉시 반영', 'API와 함께'],
            ['배치 (SFTP 등)', '야간 대량', '보조'],
            ['VPN·DB 직결 / SSH', 'PoC만', '비권장'],
          ],
        },
      },
      {
        id: 'c1',
        title: '양측 할 일',
        icon: 'list',
        sides: {
          mysum: {
            title: '마이숨',
            bullets: [
              'REST · 문서화 (필드 사전 반영)',
              '토큰 발급·로테이션 · IP · rate limit · 감사',
              '페이지네이션 · date_from/to · updated_since',
              '웹훅: 이벤트·HMAC·재시도 (가능 시)',
              '샌드박스에서 동일 계약 검증',
            ],
          },
          moabom: {
            title: '스마트케어360',
            bullets: [
              'moabom-mysum(가칭) 프록시 모듈',
              '마이숨 토큰 → Secret Manager (서버만 사용)',
              '로그인 + 역할 permission (일반 회원 차단)',
              '웹훅 수신 · 서명 검증 · idempotency · 캐시 무효화',
              '샌드박스 E2E: 조회·기간필터·쓰기 각 1건',
            ],
          },
        },
      },
      {
        id: 'c3',
        title: '웹훅 스케치',
        icon: 'bolt',
        code: `# 마이숨 → 스마트케어360
POST https://{tenant}.mek360.com/api/modules/moabom-mysum/webhooks/events
Header: X-Mysum-Signature: ...
Body: { "type":"rental.updated", "id":"...", "occurred_at":"..." }`,
      },
    ],
  },

  access: {
    title: '접근 경계',
    lead: '준비(양측) → 직원 요청 → 마이숨 원장 → 응답(·웹훅)까지 한 줄로 이어집니다. 마이숨 토큰은 서버만, 역할 permission은 사람만 담당합니다.',
    blocks: [
      {
        id: 'ac-flow',
        title: '원라인 흐름 (전체)',
        icon: 'diagram-project',
        callout: {
          tone: 'info',
          text: '담당 열 = 그 단계를 수행하는 쪽. 마이숨이 열고 검증·원장을 맡고, 스마트케어360이 보관·사람 권한·프록시를 맡습니다.',
        },
        table: {
          headers: ['#', '한 줄', '담당', '부연'],
          rows: [
            ['0', 'API 계약 확정 (필드·필터·읽기/쓰기)', '마이숨 (+360 합의)', '필드 사전·OpenAPI·date_from/to. 내부 DB는 숨김'],
            ['1', '파트너 토큰 발급 · scope · IP allowlist', '마이숨', 'Bearer/JWT/HMAC. 읽기/쓰기·병원 범위. 직원 계정 아님'],
            ['2', 'HTTPS API · (가능 시) 웹훅 엔드포인트 오픈', '마이숨', '샌드박스 동일 계약. rate limit·감사'],
            ['3', '토큰 → Secret Manager · 프록시·permission 준비', '스마트케어360', '테넌트별 secret. patients.read / as.write 등'],
            ['4', 'Admin에서 역할 permission on/off', '스마트케어360', 'User→Role→Permission. 일반회원 기본=없음'],
            ['5', '직원 로그인 → 앱이 프록시만 호출', '스마트케어360', 'Sanctum. LB→Cloud Run. 마이숨 URL 직통 금지'],
            ['6', '테넌트·permission 검사 후 Secret 토큰 부착', '스마트케어360', '실패 시 401/403. 여기까지 마이숨 요청 없음'],
            ['7', '토큰·scope·IP 검증 → 원장 조회 또는 쓰기', '마이숨', '읽기: 필터된 JSON. 쓰기: 검증 후 원장 생성(AS 등)'],
            ['8', '응답 수신 → PII 필터·감사 → 직원에게', '스마트케어360', '키는 응답에 없음. 짧은 TTL 캐시(읽기)'],
            ['9', '(선택) 원장 변경 웹훅 푸시', '마이숨 → 360', 'HMAC·event id. 360이 서명 검증·캐시 무효화'],
          ],
        },
      },
      {
        id: 'ac-rw',
        title: '읽기 vs 쓰기 (#5~8에서 갈라짐)',
        icon: 'right-left',
        table: {
          headers: ['구분', '한 줄', '담당', '부연'],
          rows: [
            ['읽기', '#5~6 동일 → #7 마이숨 GET → #8 목록 표시', '양쪽', 'permission: *.read · 기간·status 쿼리는 마이숨이 처리'],
            ['읽기', '캐시 · 웹훅(#9)로 무효화', '스마트케어360', '원장 수정 없음'],
            ['쓰기', '#5~6 동일 → #7 마이숨 POST 원장 생성 → #8 결과', '양쪽', 'permission: as.write 필수. 마이숨이 필수 필드·scope 검증'],
            ['쓰기', '감사 · 멱등 · (가능 시) #9 웹훅', '양쪽', '중복 접수 방지. 360=누가 썼는지, 마이숨=원장 이벤트'],
          ],
        },
        code: `# 읽기
GET  /api/modules/moabom-mysum/rentals?status=due&date_from=&date_to=
  → (#6 rentals.read + Secret) → GET mysum /api/v1/rentals?...
  → (#7 마이숨 원장 조회) → (#8 필터 후 직원)

# 쓰기
POST /api/modules/moabom-mysum/as-tickets
  → (#6 as.write + Secret) → POST mysum /api/v1/as-tickets
  → (#7 마이숨 원장 생성) → (#8 결과) → (#9 웹훅 가능)`,
      },
      {
        id: 'ac2',
        title: '누가 되고 / 안 되나',
        icon: 'users',
        table: {
          headers: ['대상', '읽기', '쓰기(AS)'],
          rows: [
            ['비로그인 · 게스트', '불가', '불가'],
            ['일반 회원 (권한 없음)', '불가', '불가'],
            ['병원 직원 (*.read만)', '가능 (자기 테넌트)', '불가'],
            ['상담·AS (*.write)', '가능', '가능'],
            ['다른 병원 · 공개 AI 앱 방문자', '불가', '불가'],
          ],
        },
      },
    ],
  },

  'ai-apps': {
    title: 'AI 앱 · 활용',
    lead: 'AI 앱 생성기는 이미 운영 중입니다. 마이숨 API + 프록시 + 직원 권한이 맞으면, 권한자만 조회·접수 앱을 붙일 수 있습니다.',
    blocks: [
      {
        id: 'ai0',
        title: '실현 경로',
        icon: 'list',
        table: {
          headers: ['단계', '내용', '상태'],
          rows: [
            ['1', 'AI 앱 생성기 (프롬프트 → 앱 UI)', '운영 중'],
            ['2', '마이숨 API + 플랫폼 프록시 + Secret Manager', '연동 합의 후'],
            ['3', '생성 앱 → 프록시 → 마이숨 (읽기/쓰기)', 'API 오픈 후'],
          ],
        },
        callout: {
          tone: 'info',
          text: '생성 앱도 #5~8 접근 경계를 그대로 탑니다. 마이숨 토큰은 Secret Manager에만 있고, 일반 회원은 불가합니다.',
        },
      },
      {
        id: 'ai1',
        title: '바로 만들 수 있는 예',
        icon: 'lightbulb',
        bullets: [
          '회수 예정 목록 (기간·status 필터)',
          '환자·계약 간단 조회 (최소 필드)',
          'AS 접수 창 (POST → 마이숨 원장)',
          '병원별 대시보드 (같은 API, tenant만 다름)',
        ],
      },
    ],
  },
};
