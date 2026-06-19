import type { App } from '../../data/Moa_apps';

export const consultingAppMetadata: App = {
  id: 'consulting',
  name: '360 컨설팅',
  description: '병원 수익성 시뮬레이션 · 전자계약',
  defaultLocale: 'ko',
  i18n: {
    ko: {
      name: '360 컨설팅',
      description: '병원 수익성 시뮬레이션 · 전자계약',
    },
    en: {
      name: '360 Consulting',
      description: 'Hospital profitability simulation & e-contract',
    },
    ja: {
      name: '360コンサルティング',
      description: '病院収益性シミュレーション・電子契約',
    },
    zh: {
      name: '360 咨询',
      description: '医院盈利能力模拟与电子合同',
    },
  },
  icon: 'handshake',
  gradient: 'linear-gradient(135deg,#27bfc1,#479ee2)',
  category: 'basic',
  source: 'system',
};
