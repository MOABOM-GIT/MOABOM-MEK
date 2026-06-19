import { createShellAppMetadata } from '../_shared/createShellAppMetadata';

export const refurbRequestAppMetadata = createShellAppMetadata({
  id: 'refurb-request',
  icon: 'recycle',
  gradient: 'linear-gradient(135deg,#34d399,#0d9488)',
  strings: {
    ko: { name: '리퍼비시 요청', description: '리퍼비시·재정비 요청' },
    en: { name: 'Refurbishment Request', description: 'Refurbishment and reconditioning requests' },
    ja: { name: 'リファービッシュ依頼', description: 'リファービッシュ・再整備依頼' },
    zh: { name: '翻新申请', description: '翻新与再整备申请' },
  },
});
