import React from 'react';
import type { MoabomTranslateFn } from '../../../i18n/moabomT';
import type { ActivityItem, ActivityOverview } from './myPageTypes';
import { APP_STACK_CLASS } from '../../../apps/appShellTypography';
import { Button } from '../../basic/Button';
import AppLoadingSpinner from '../AppLoadingSpinner';
import { Div } from '../../basic/Div';
import { Icon } from '../../basic/Icon';
import { Span } from '../../basic/Span';
import { ACTIVITY_FILTER_IDS, POINT_COLOR } from './myPageConstants';
import { GROUP_PANEL } from './myPageStyles';
import { activityFilterLabelKey, optionButtonVariant } from './myPageUtils';

export interface Moa_MyPageActivityPanelProps {
  t: MoabomTranslateFn;
  /** 관리자·슈퍼관리자 세션일 때 내 활동 상단 안내 표시 */
  showAdminSessionNotice?: boolean;
  activityOverview: ActivityOverview | null;
  activityFilter: string;
  setActivityFilter: (id: string) => void;
  activityLoading: boolean;
  activityError: string;
  onOpenActivity: (item: ActivityItem) => void;
}

export const Moa_MyPageActivityPanel: React.FC<Moa_MyPageActivityPanelProps> = ({
  t,
  showAdminSessionNotice = false,
  activityOverview,
  activityFilter,
  setActivityFilter,
  activityLoading,
  activityError,
  onOpenActivity,
}) => {
  const postsCount = activityOverview?.summary?.posts_count ?? 0;
  const commentsCount = activityOverview?.summary?.comments_count ?? 0;
  const interactionsCount = activityOverview?.summary?.interactions_count ?? 0;

  return (
    <Div className={`${GROUP_PANEL} p-5 ${APP_STACK_CLASS}`}>
    <Div className="grid grid-cols-3 gap-2 @sm:gap-3 text-center">
      <Div className="glass-sm min-w-0 rounded-2xl px-2 py-3 @sm:px-4 @sm:py-4">
        <Div className="text-lg @sm:text-2xl font-bold text-primary leading-tight">{postsCount.toLocaleString()}</Div>
        <Div className="mt-1 text-xs @sm:text-xs text-muted whitespace-nowrap">{t('moa_mypage.activity.stat_posts')}</Div>
      </Div>
      <Div className="glass-sm min-w-0 rounded-2xl px-2 py-3 @sm:px-4 @sm:py-4">
        <Div className="text-lg @sm:text-2xl font-bold text-primary leading-tight">{commentsCount.toLocaleString()}</Div>
        <Div className="mt-1 text-xs @sm:text-xs text-muted whitespace-nowrap">{t('moa_mypage.activity.stat_comments')}</Div>
      </Div>
      <Div className="glass-sm min-w-0 rounded-2xl px-2 py-3 @sm:px-4 @sm:py-4">
        <Div className="text-lg @sm:text-2xl font-bold text-primary leading-tight">{interactionsCount.toLocaleString()}</Div>
        <Div className="mt-1 text-xs @sm:text-xs text-muted whitespace-nowrap">{t('moa_mypage.activity.stat_interactions')}</Div>
      </Div>
    </Div>

    {showAdminSessionNotice ? (
      <Div
        className="glass-sm px-3 py-3 rounded-xl text-xs text-muted leading-relaxed border border-amber-500/25 dark:border-amber-400/20"
        data-testid="mypage-activity-admin-notice"
      >
        {t('moa_mypage.activity.admin_session_notice')}
      </Div>
    ) : null}

    <Div className="grid grid-cols-2 gap-2 @sm:flex @sm:flex-wrap">
      {ACTIVITY_FILTER_IDS.map(filterId => (
        <Button
          key={filterId}
          type="button"
          variant={optionButtonVariant(activityFilter === filterId)}
          size="medium"
          onClick={() => setActivityFilter(filterId)}
          className="w-full @sm:w-auto @sm:min-w-[92px]"
        >
          {t(activityFilterLabelKey(filterId))}
        </Button>
      ))}
    </Div>

    {activityOverview != null && !activityOverview.summary.likes_supported ? (
      <Div className="glass-sm px-3 py-3 rounded-xl text-xs text-muted leading-relaxed">
        {t('moa_mypage.activity.likes_notice')}
      </Div>
    ) : null}

    <Div className={APP_STACK_CLASS}>
      {activityError ? (
        <Div className="glass-sm px-3 py-3 rounded-xl text-sm text-red-500">{activityError}</Div>
      ) : null}
      {!activityError && activityLoading ? (
        <Div className="glass-sm rounded-xl px-3 py-3">
          <AppLoadingSpinner label={t('moa_mypage.activity.loading')} />
        </Div>
      ) : null}
      {!activityError && !activityLoading && (activityOverview?.items.length ?? 0) === 0 ? (
        <Div className="glass-sm px-3 py-3 rounded-xl text-sm text-muted">{t('moa_mypage.activity.empty')}</Div>
      ) : null}
      {!activityError && !activityLoading ? activityOverview?.items.map(item => (
        <Button
          key={item.id}
          type="button"
          onClick={() => onOpenActivity(item)}
          disabled={!item.target_url}
          className="w-full flex items-start gap-3 rounded-2xl border-0 bg-white/45 dark:bg-white/5 px-3 py-3 text-left hover:bg-white/60 dark:hover:bg-white/10 disabled:cursor-default disabled:opacity-80"
        >
          <Div className="glass-sm w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
            <Icon name={item.icon || 'clock'} className="text-sm" style={{ color: POINT_COLOR }} />
          </Div>
          <Div className="min-w-0 flex-1">
            <Div className="flex items-center gap-2">
              <Span className="rounded-full bg-white/70 dark:bg-white/10 px-2 py-0.5 text-xs font-bold text-muted">
                {item.type_label}
              </Span>
              {item.board_name ? (
                <Span className="text-xs text-muted">{item.board_name}</Span>
              ) : null}
            </Div>
            <Div className="mt-1 text-sm font-bold text-primary line-clamp-1">{item.title}</Div>
            {item.description ? (
              <Div className="mt-1 text-xs text-secondary line-clamp-2">{item.description}</Div>
            ) : null}
            <Div className="mt-2 text-xs text-faint">
              {[item.meta, item.occurred_at_human].filter(Boolean).join(' · ')}
            </Div>
          </Div>
        </Button>
      )) : null}
    </Div>
  </Div>
  );
};
