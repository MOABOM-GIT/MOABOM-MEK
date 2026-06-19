import { createShellAppMetadata } from '../_shared/createShellAppMetadata';

export const cpapReturnAppMetadata = createShellAppMetadata({
  id: 'cpap-return',
  icon: 'truck',
  gradient: 'linear-gradient(135deg,#fb923c,#f43f5e)',
  strings: {
    ko: { name: '양압기 회수', description: '양압기 회수 접수 및 일정' },
    en: { name: 'CPAP Return', description: 'CPAP return pickup scheduling' },
    ja: { name: 'CPAP回収', description: 'CPAP回収受付とスケジュール' },
    zh: { name: '呼吸机回收', description: '呼吸机回收受理与日程' },
  },
});
