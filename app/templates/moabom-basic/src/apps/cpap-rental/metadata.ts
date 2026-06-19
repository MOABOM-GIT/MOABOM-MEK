import { createShellAppMetadata } from '../_shared/createShellAppMetadata';

export const cpapRentalAppMetadata = createShellAppMetadata({
  id: 'cpap-rental',
  icon: 'hand-holding-medical',
  gradient: 'linear-gradient(135deg,#22d3ee,#3b82f6)',
  strings: {
    ko: { name: '양압기 임대', description: '양압기 임대 신청 및 관리' },
    en: { name: 'CPAP Rental', description: 'CPAP rental requests and management' },
    ja: { name: 'CPAPレンタル', description: 'CPAPレンタル申請と管理' },
    zh: { name: '呼吸机租赁', description: '呼吸机租赁申请与管理' },
  },
});
