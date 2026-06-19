import type { AuthWindowMode } from '../../components/composite/Moa_AuthWindowContent';

/** URL 동기화 생략 (브라우저 경로가 이미 목표와 같을 때, popstate 복원 등) */
export type ShellUrlSync = {
  skipUrl?: boolean;
  /** 게시판 윈도우 — pathname+search 전체 (쿼리 유지) */
  shellPath?: string;
  replace?: boolean;
};

export type ResponsiveMode = 'desktop' | 'right-overlay' | 'mobile-overlay';

export interface HomePageProps {
  initialWindow?: AuthWindowMode;
}

export interface MoaCurrentUser {
  name: string;
  level: number;
  point: number;
  avatar?: string | null;
  is_admin?: boolean;
  is_super?: boolean;
  social_provider?: string | null;
  language?: 'ko' | 'en' | null;
  memberKey?: string;
}

export interface AuthUserLike {
  id?: number | string;
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
