import React from 'react';
import type { MoabomSystemLanguage } from '../types/moabomSystem';
import { interpolateMoabomTemplate } from './moabomTranslationOverlay';
import { MoabomUiI18nContext, type MoabomUiI18nContextValue } from './MoabomUiI18nProvider';

/** Vitest 등에서 셸 컴포넌트만 렌더할 때 사용하는 고정 한국어 스텁 */
const STUB_KO: Record<string, string> = {
  'moa_shell.login_prompt.email_login': '이메일로 로그인',
  'moa_shell.login_prompt.sns_label': 'SNS',
  'moa_shell.login_prompt.social_google': '구글로 계속하기',
  'moa_shell.login_prompt.social_naver': '네이버로 계속하기',
  'moa_shell.login_prompt.social_kakao': '카카오로 계속하기',
  'moa_shell.center.edit_mode_title': '앱 편집 모드',
  'moa_shell.center.create_app_title': 'AI 앱 만들기',
  'moa_shell.center.create_app_desc': '프롬프트로 웹앱 만들기',
  'moa_shell.modes.apps.name': 'SMARTCARE APPS',
  'moa_shell.modes.apps.desc': '다양한 앱을 탐색하세요',
  'moa_shell.modes.sites.name': 'SMARTCARE SITES',
  'moa_shell.modes.sites.desc': '웹사이트 모음',
  'moa_shell.modes.work.name': 'SMARTCARE WORK',
  'moa_shell.modes.work.desc': '업무용 도구 모음',
  'moa_shell.center.terms': '이용약관',
  'moa_shell.center.privacy': '개인정보처리방침',
  'moa_shell.center.copyright': '© 2026 SMARTCARE360. All rights reserved.',
  'moa_shell.center.legal_page_loading': '불러오는 중…',
  'moa_shell.center.legal_page_error': '페이지를 불러오지 못했습니다.',
  'moa_shell.center.legal_page_empty': '등록된 내용이 없습니다.',
  'moa_shell.center.legal_page_retry': '다시 시도',
  'moa_shell.center.locale_settings_aria': '언어 및 환경설정',
  'moa_shell.center.toggle_left_panel_on': '좌측 패널 닫기',
  'moa_shell.center.toggle_left_panel_off': '좌측 패널 열기',
  'moa_shell.center.toggle_right_panel_on': '우측 패널 닫기',
  'moa_shell.center.toggle_right_panel_off': '우측 패널 열기',
  'moa_shell.right.admin_mode': '관리자 모드',
  'moa_auth.social_google_short': '구글',
  'moa_auth.social_naver_short': '네이버',
  'moa_auth.social_kakao_short': '카카오',
  'moa_auth.sns_divider': 'SNS',
};

function stubT(key: string, params?: Record<string, string | number>): string {
  let s = STUB_KO[key] ?? key;
  if (params) {
    s = interpolateMoabomTemplate(s, params);
  }
  return s;
}

const stubValue: MoabomUiI18nContextValue = {
  t: stubT,
  language: 'ko' as MoabomSystemLanguage,
};

export function MoabomUiI18nTestProvider({ children }: { children: React.ReactNode }) {
  return <MoabomUiI18nContext.Provider value={stubValue}>{children}</MoabomUiI18nContext.Provider>;
}
