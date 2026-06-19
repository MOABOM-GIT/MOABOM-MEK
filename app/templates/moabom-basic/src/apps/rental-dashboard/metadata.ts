import { createShellAppMetadata } from '../_shared/createShellAppMetadata';

export const rentalDashboardAppMetadata = createShellAppMetadata({
  id: 'rental-dashboard',
  icon: 'chart-line',
  gradient: 'linear-gradient(135deg,#38bdf8,#1d4ed8)',
  strings: {
    ko: { name: '임대현황 대시보드', description: '임대·회수 현황 한눈에' },
    en: { name: 'Rental Dashboard', description: 'Rental and return status at a glance' },
    ja: { name: 'レンタル現況ダッシュボード', description: 'レンタル・回収状況を一覧表示' },
    zh: { name: '租赁状态仪表板', description: '租赁与回收状态一览' },
  },
});
