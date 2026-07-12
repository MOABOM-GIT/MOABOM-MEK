import type { App } from '../../data/Moa_apps';

export const mysumIntegrationAppMetadata: App = {
  id: 'mysum-integration',
  name: '마이숨 데이터 연동',
  description: '개발자 회의용 — 마이숨(DX) ↔ 스마트케어360 연동 브리프',
  defaultLocale: 'ko',
  i18n: {
    ko: {
      name: '마이숨 데이터 연동',
      description: '개발자 회의용 — 마이숨(DX) ↔ 스마트케어360 연동 브리프',
    },
    en: {
      name: 'MySum Data Integration',
      description: 'Dev meeting brief — MySum (DX) ↔ Smartcare360',
    },
    ja: {
      name: 'マイスムデータ連携',
      description: '開発者向け会議ブリーフ — マイスム(DX) ↔ Smartcare360',
    },
    zh: {
      name: 'MySum 数据对接',
      description: '开发者会议简报 — MySum(DX) ↔ Smartcare360',
    },
  },
  icon: 'database',
  gradient: 'linear-gradient(135deg,#0d9488,#2563eb)',
  category: 'basic',
  source: 'system',
};
