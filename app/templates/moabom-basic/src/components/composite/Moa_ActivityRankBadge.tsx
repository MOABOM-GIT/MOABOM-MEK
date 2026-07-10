import React from 'react';
import { useMoabomShellT } from '../../i18n/MoabomUiI18nProvider';
import { Div } from '../basic/Div';
import { Icon } from '../basic/Icon';
import { Span } from '../basic/Span';
import {
  ACTIVITY_RANK_ICONS,
  resolveActivityRankSlug,
  type ActivityRankSlug,
} from '../../shell/moaActivityLevel';

export type MoaActivityRankBadgeProps = {
  level?: number | null;
  slug?: ActivityRankSlug | string | null;
  className?: string;
  /** compact: 아이콘+Lv.N / default: 아이콘+Lv.N 등급명 */
  size?: 'sm' | 'md';
  showLabel?: boolean;
};

export const Moa_ActivityRankBadge: React.FC<MoaActivityRankBadgeProps> = ({
  level = 1,
  slug,
  className = '',
  size = 'sm',
  showLabel = true,
}) => {
  const { t } = useMoabomShellT();
  const safeLevel = Math.min(10, Math.max(1, Math.floor(Number(level) || 1)));
  const resolvedSlug = (slug && ACTIVITY_RANK_ICONS[slug as ActivityRankSlug]
    ? (slug as ActivityRankSlug)
    : resolveActivityRankSlug(safeLevel));
  const iconName = ACTIVITY_RANK_ICONS[resolvedSlug];
  const tierName = t(`moa_shell.rank.levels.${resolvedSlug}`);
  const label = showLabel
    ? t('moa_shell.rank.badge_label', { level: safeLevel, name: tierName })
    : `Lv.${safeLevel}`;

  return (
    <Span
      className={`moa-activity-rank-badge moa-activity-rank-badge--${size} moa-activity-rank-lv-${safeLevel}${className ? ` ${className}` : ''}`}
      title={label}
    >
      <Icon name={iconName} className="moa-activity-rank-badge__icon" />
      <Span className="moa-activity-rank-badge__text">{label}</Span>
    </Span>
  );
};

export type MoaActivityExpBarProps = {
  progressRatio: number;
  className?: string;
  highlight?: boolean;
};

export const Moa_ActivityExpBar: React.FC<MoaActivityExpBarProps> = ({
  progressRatio,
  className = '',
  highlight = false,
}) => {
  const width = `${Math.round(Math.max(0, Math.min(1, progressRatio)) * 100)}%`;

  return (
    <Div
      className={`moa-activity-exp-bar${highlight ? ' moa-activity-exp-bar--highlight' : ''}${className ? ` ${className}` : ''}`}
    >
      <Div className="moa-activity-exp-bar__fill" style={{ width }} />
    </Div>
  );
};
