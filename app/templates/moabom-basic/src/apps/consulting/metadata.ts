import type { App } from '../../data/Moa_apps';

export const consultingAppMetadata: App = {
  id: 'consulting',
  name: '스마트 컨설팅',
  description: '업체 수익성 시뮬레이션 · 전자계약',
  defaultLocale: 'ko',
  i18n: {
    ko: {
      name: '스마트 컨설팅',
      description: '업체 수익성 시뮬레이션 · 전자계약',
    },
    en: {
      name: 'Smart Consulting',
      description: 'Company profitability simulation & e-contract',
    },
    ja: {
      name: 'スマートコンサルティング',
      description: '企業収益性シミュレーション・電子契約',
    },
    zh: {
      name: '智能咨询',
      description: '企业盈利能力模拟与电子合同',
    },
  },
  icon: 'handshake',
  gradient: 'linear-gradient(135deg,#27bfc1,#479ee2)',
  category: 'basic',
  source: 'system',
};
