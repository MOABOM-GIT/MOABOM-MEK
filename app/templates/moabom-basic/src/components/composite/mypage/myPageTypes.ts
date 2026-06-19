/** 마이페이지 탭·API·도메인 타입 (Moa_MyPageWindowContent 분리용) */

import type { App } from '../../../data/Moa_apps';

export type MyPageTab = 'profile' | 'settings' | 'credit' | 'library' | 'activity' | 'account' | 'subscription';

export interface MyPageUser {
  name: string;
  level: number;
  point: number;
  avatar?: string | null;
  is_admin?: boolean;
  is_super?: boolean;
  social_provider?: string | null;
  /** 코어 프로필 언어(ko|en). 동기 축 */
  language?: 'ko' | 'en' | null;
  /**
   * 로그인 사용자 구분용 키(id 우선, 없으면 이메일).
   * 프로필·언어 필드만 바뀔 때와 동일 세션으로 두어 설정 GET 재호출 레이스를 막습니다.
   */
  memberKey?: string;
}

export interface MyPageWindowContentProps {
  /** 최초로 열 탭 */
  initialTab?: MyPageTab;
  /** AuthManager에서 가져온 현재 사용자 정보 */
  currentUser: MyPageUser | null;
  /** 앱 보관함에서 앱 실행 */
  onOpenApp?: (app: App) => void;
  /** 저장 AI 앱 편집 (create-app 셸) */
  onEditGeneratedApp?: (serverId: number) => void;
  /** 저장 AI 앱 영구 삭제 */
  onDeleteGeneratedApp?: (serverId: number) => void;
  /** 저장 AI 앱 공유 토글 */
  onToggleGeneratedAppShare?: (serverId: number, nextShared: boolean) => void;
  /** 서버에 저장된 AI 생성 앱 목록(홈/좌측 패널과 동기화) */
  createdApps?: App[];
  /** 좌측 패널과 공유되는 즐겨찾기 앱 목록 */
  favoriteApps?: App[];
  /** 최근 실행 앱 목록 */
  recentApps?: App[];
  /** 프로필 API 저장 후 부모(홈) 사용자 표시 동기화 */
  onProfileUpdated?: (user?: AuthManagerUserSnapshot | null) => void;
  /** 활성 탭 변경 시 (REST 경로 `/me/:tab` 동기화용) */
  onActiveTabChange?: (tab: MyPageTab) => void;
}

/** AuthManager.getUser() 등과 호환되는 최소 사용자 스냅샷 */
export interface AuthManagerUserSnapshot {
  name?: string;
  nickname?: string;
  email?: string;
  avatar?: string | null;
  level?: number;
  point?: number;
  is_admin?: boolean;
  is_super?: boolean;
  social_provider?: string | null;
  language?: string | null;
}

export interface TabDefinition {
  id: MyPageTab;
  icon: string;
}

/** @deprecated 폴백 탭 메타는 번역 키로 조합합니다. */
export interface TabConfig extends TabDefinition {
  label: string;
  desc: string;
}

export interface ProfileApiPayload {
  name?: string;
  nickname?: string | null;
  email?: string;
  mobile?: string | null;
  bio?: string | null;
  avatar?: string | null;
  social_provider?: string | null;
}

export interface ApiProfileResponse {
  success?: boolean;
  message?: string;
  data?: ProfileApiPayload;
  errors?: Record<string, string[] | string>;
}

export interface ApiAvatarResponse {
  success?: boolean;
  message?: string;
  data?: {
    avatar?: string | null;
    attachment_id?: number;
  };
  errors?: Record<string, string[] | string>;
}

export interface CreditTransaction {
  id: number;
  type?: string | null;
  type_label?: string | null;
  amount: number;
  balance_after: number;
  description?: string | null;
  created_at?: string | null;
  created_at_human?: string | null;
}

export interface CreditOverview {
  balance: number;
  summary: {
    total_earned: number;
    total_used: number;
    transaction_count: number;
  };
  transactions: CreditTransaction[];
}

export interface ApiCreditResponse {
  success?: boolean;
  message?: string;
  data?: CreditOverview;
}

export interface ApiAttendanceResponse {
  success?: boolean;
  message?: string;
  data?: {
    overview?: CreditOverview;
  };
  errors?: {
    message?: string;
  };
}

export interface ActivityItem {
  id: string;
  type: 'post' | 'comment' | 'interaction';
  type_label: string;
  icon?: string;
  title: string;
  description?: string | null;
  actor_name?: string | null;
  board_name?: string | null;
  board_slug?: string | null;
  post_id?: number | null;
  comment_id?: number | null;
  target_url?: string | null;
  meta?: string | null;
  occurred_at?: string | null;
  occurred_at_human?: string | null;
}

export interface ActivityOverview {
  summary: {
    posts_count: number;
    comments_count: number;
    interactions_count: number;
    likes_supported?: boolean;
  };
  items: ActivityItem[];
}

export interface ApiActivityResponse {
  success?: boolean;
  message?: string;
  data?: ActivityOverview;
  errors?: Record<string, string[] | string>;
}

export interface ApiSimpleResponse {
  success?: boolean;
  message?: string;
  errors?: Record<string, string[] | string>;
}
