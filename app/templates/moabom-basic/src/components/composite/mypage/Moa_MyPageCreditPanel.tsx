import React from 'react';
import type { MoabomTranslateFn } from '../../../i18n/moabomT';
import type { CreditOverview } from './myPageTypes';
import { Button } from '../../basic/Button';
import AppLoadingSpinner from '../AppLoadingSpinner';
import { Div } from '../../basic/Div';
import { Icon } from '../../basic/Icon';
import { Span } from '../../basic/Span';
import { formatCredit } from './myPageUtils';
import { APP_STACK_CLASS, APP_STACK_GRID_CLASS } from '../../../apps/appShellTypography';
import { GROUP_PANEL, MY_PAGE_BLOCK_TITLE_TEXT_CLASS } from './myPageStyles';

export interface Moa_MyPageCreditPanelProps {
  t: MoabomTranslateFn;
  creditBalance: number;
  creditOverview: CreditOverview | null;
  creditLoading: boolean;
  creditLoadingMore?: boolean;
  creditHasMore?: boolean;
  creditError: string;
  attendanceLoading: boolean;
  attendanceMessage: string;
  onAttendanceCheck: () => void;
  onLoadMoreCredits?: () => void;
}

export const Moa_MyPageCreditPanel: React.FC<Moa_MyPageCreditPanelProps> = ({
  t,
  creditBalance,
  creditOverview,
  creditLoading,
  creditLoadingMore = false,
  creditHasMore = false,
  creditError,
  attendanceLoading,
  attendanceMessage,
  onAttendanceCheck,
  onLoadMoreCredits,
}) => (
  <Div className={`moa-mypage-credit ${APP_STACK_GRID_CLASS} grid grid-cols-[240px_1fr]`}>
    <Div className={`rounded-3xl p-6 text-white shadow-xl ${APP_STACK_CLASS}`} style={{ background: 'linear-gradient(135deg,#ec4899,#8b5cf6)' }}>
      <Span className="block text-sm text-white/70">{t('moa_mypage.credit.balance_label')}</Span>
      <Div className="text-3xl font-bold">{formatCredit(creditBalance, t)}</Div>
      <Div className="grid grid-cols-2 gap-2 text-xs text-white/75">
        <Div>
          <Span className="block text-white/55">{t('moa_mypage.credit.total_earned')}</Span>
          <Span className="font-bold">{(creditOverview?.summary.total_earned ?? 0).toLocaleString()}</Span>
        </Div>
        <Div>
          <Span className="block text-white/55">{t('moa_mypage.credit.total_used')}</Span>
          <Span className="font-bold">{(creditOverview?.summary.total_used ?? 0).toLocaleString()}</Span>
        </Div>
      </Div>
      <Button
        type="button"
        variant="neutral"
        size="large"
        disabled={attendanceLoading || creditLoading}
        onClick={() => void onAttendanceCheck()}
        className="w-full justify-center gap-2 shadow-md disabled:opacity-60"
      >
        {attendanceLoading ? (
          <Icon name="spinner" className="text-base animate-spin" aria-hidden />
        ) : (
          <Icon name="calendar-alt" className="text-base" aria-hidden />
        )}
        <Span>
          {attendanceLoading ? t('moa_mypage.credit.attendance_loading') : t('moa_mypage.credit.attendance')}
        </Span>
      </Button>
      {attendanceMessage ? (
        <Div className="mt-3 text-xs text-white/80">{attendanceMessage}</Div>
      ) : null}
    </Div>
    <Div className={`${GROUP_PANEL} p-5`}>
      <Div className="mb-3 flex items-center justify-between gap-2">
        <Div className={MY_PAGE_BLOCK_TITLE_TEXT_CLASS}>{t('moa_mypage.credit.recent_title')}</Div>
      </Div>
      <Div className="flex flex-col gap-2">
        {creditError ? (
          <Div className="glass-sm px-3 py-3 rounded-xl text-sm text-red-500">{creditError}</Div>
        ) : null}
        {!creditError && creditLoading ? (
          <Div className="glass-sm rounded-xl px-3 py-3">
            <AppLoadingSpinner label={t('moa_mypage.credit.loading_rows')} />
          </Div>
        ) : null}
        {!creditError && !creditLoading && (creditOverview?.transactions.length ?? 0) === 0 ? (
          <Div className="glass-sm px-3 py-3 rounded-xl text-sm text-muted">{t('moa_mypage.credit.empty')}</Div>
        ) : null}
        {!creditError && !creditLoading ? creditOverview?.transactions.map(item => {
          const isPlus = item.amount >= 0;
          return (
            <Div key={item.id} className="glass-sm flex items-center gap-3 px-3 py-3 rounded-xl">
              <Div className={`glass-sm w-9 h-9 rounded-xl flex items-center justify-center ${isPlus ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                <Icon name={isPlus ? 'plus' : 'minus'} className={`text-sm ${isPlus ? 'text-emerald-500' : 'text-rose-500'}`} />
              </Div>
              <Div className="flex-1 min-w-0">
                <Div className="text-sm font-bold text-primary truncate">{item.description || item.type_label || t('moa_mypage.credit.transaction_fallback')}</Div>
                <Div className="text-xs text-muted">{item.created_at_human || item.created_at || ''}</Div>
              </Div>
              <Span className={`text-sm font-bold ${isPlus ? 'text-emerald-500' : 'text-rose-500'}`}>
                {item.amount > 0 ? '+' : ''}{item.amount.toLocaleString()}
              </Span>
            </Div>
          );
        }) : null}
        {creditHasMore && onLoadMoreCredits ? (
          <Button
            type="button"
            variant="secondary"
            size="medium"
            className="w-full justify-center"
            disabled={creditLoadingMore || creditLoading}
            onClick={() => void onLoadMoreCredits()}
          >
            {creditLoadingMore ? t('moa_mypage.credit.loading_more') : t('moa_mypage.credit.load_more')}
          </Button>
        ) : null}
      </Div>
    </Div>
  </Div>
);
