import { createShellAppMetadata } from '../_shared/createShellAppMetadata';

export const asRequestAppMetadata = createShellAppMetadata({
  id: 'as-request',
  icon: 'screwdriver-wrench',
  gradient: 'linear-gradient(135deg,#a78bfa,#6366f1)',
  strings: {
    ko: { name: 'AS 요청', description: 'A/S 수리 및 점검 요청' },
    en: { name: 'Service Request', description: 'After-service repair and inspection requests' },
    ja: { name: 'AS依頼', description: 'アフターサービス修理・点検依頼' },
    zh: { name: 'AS申请', description: '售后服务维修与检查申请' },
  },
});
