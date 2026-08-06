import { Div } from '../basic/Div';
import { Icon } from '../basic/Icon';

type GeneratedAppUserBadgeSize = 'sm' | 'md' | 'lg';

const sizeClass: Record<GeneratedAppUserBadgeSize, { shell: string; icon: string }> = {
  sm: { shell: 'h-3.5 w-3.5', icon: 'text-[7px]' },
  md: { shell: 'h-4 w-4', icon: 'text-[8px]' },
  lg: { shell: 'h-5 w-5', icon: 'text-[10px]' },
};

export function Moa_GeneratedAppUserBadge({
  size = 'md',
}: {
  size?: GeneratedAppUserBadgeSize;
}) {
  const classes = sizeClass[size];

  return (
    <Div
      className={`moa-generated-app-user-badge absolute z-[2] flex items-center justify-center rounded-full border-2 border-white/90 bg-white text-slate-700 shadow-md dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 ${classes.shell}`}
      aria-hidden
    >
      <Icon name="user" className={classes.icon} />
    </Div>
  );
}
