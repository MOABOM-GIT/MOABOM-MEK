import { createShellAppMetadata } from '../_shared/createShellAppMetadata';

export const settlementAppMetadata = createShellAppMetadata({
  id: 'settlement',
  icon: 'file-invoice-dollar',
  gradient: 'linear-gradient(135deg,#c084fc,#f472b6)',
  strings: {
    ko: { name: '정산서', description: '임대 정산 및 명세서' },
    en: { name: 'Settlement Statement', description: 'Rental billing and statements' },
    ja: { name: '精算書', description: 'レンタル精算と明細書' },
    zh: { name: '结算单', description: '租赁结算与明细' },
  },
});
