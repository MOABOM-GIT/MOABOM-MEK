import type { ReactNode } from 'react';
import { Button } from '../../components/basic/Button';
import { Div } from '../../components/basic/Div';
import { Icon } from '../../components/basic/Icon';
import { Span } from '../../components/basic/Span';
import { APP_STACK_CLASS, APP_STACK_GRID_CLASS, APP_WINDOW_BODY_CLASS } from '../appShellTypography';

/**
 * 앱 공용 탭 셸 (헤더 + 번호 탭 바 + 활성 콘텐츠) — SSOT.
 *
 * controlled: 부모가 activeKey 를 소유 → 탭 간 상태 공유/프로그램적 전환(예: "계약으로 이동")이 자유롭다.
 *   <AppTabsShell title=… icon=… gradient=… tabs={[{ key, no, icon, label, content }]} activeKey onActiveKeyChange />
 */
export interface AppTab {
  key: string;
  /** "01" 같은 단계 번호(선택). */
  no?: string;
  icon?: string;
  label: string;
  content: ReactNode;
}

interface AppTabsShellProps {
  title: string;
  subtitle?: string;
  icon?: string;
  gradient?: string;
  tabs: AppTab[];
  activeKey: string;
  onActiveKeyChange: (key: string) => void;
}

export function AppTabsShell({
  title,
  subtitle,
  icon = 'cube',
  gradient = 'linear-gradient(135deg,#0ea5e9,#1d4ed8)',
  tabs,
  activeKey,
  onActiveKeyChange,
}: AppTabsShellProps) {
  const active = tabs.find(t => t.key === activeKey) ?? tabs[0];

  return (
    <Div className={`${APP_WINDOW_BODY_CLASS} min-h-full`}>
      {/* 헤더 */}
      <Div className="rounded-[1.75rem] px-6 py-8 text-white shadow-xl" style={{ background: gradient }}>
        <Div className="flex items-center gap-4">
          <Div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/35 ring-1 ring-white/45">
            <Icon name={icon} className="text-2xl text-white" />
          </Div>
          <Div className="min-w-0">
            <Div className="text-2xl font-bold leading-tight tracking-tight">{title}</Div>
            {subtitle && <Div className="mt-1.5 text-sm font-semibold leading-relaxed text-white/85">{subtitle}</Div>}
          </Div>
        </Div>
      </Div>

      {/* 탭 바 */}
      <Div className={`${APP_STACK_GRID_CLASS} grid grid-cols-2 @lg:grid-cols-4`}>
        {tabs.map(tab => {
          const isActive = tab.key === active?.key;
          return (
            <Button
              key={tab.key}
              variant={isActive ? 'primary' : 'secondary'}
              onClick={() => onActiveKeyChange(tab.key)}
              className={`flex h-auto min-h-[4.5rem] flex-col items-start justify-center gap-1 !rounded-2xl !px-4 !py-3.5 text-left ${
                isActive
                  ? '!border-transparent !bg-[#479ee2] !text-white shadow-md shadow-[#479ee2]/20'
                  : '!border-slate-200/80 !bg-white !text-[#0f2d3a] hover:!border-[#27bfc1]/45 hover:!bg-[#27bfc1]/8 dark:!border-white/10 dark:!bg-slate-900/70 dark:!text-slate-200'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {tab.no && (
                <Span className={`text-xs font-bold ${isActive ? 'text-white/80' : 'text-muted'}`}>{tab.no}</Span>
              )}
              <Span className="flex items-center gap-2 text-sm font-bold">
                {tab.icon && <Icon name={tab.icon} size="sm" />}
                {tab.label}
              </Span>
            </Button>
          );
        })}
      </Div>

      {/* 활성 콘텐츠 */}
      <Div className="min-h-0 flex-1 pb-2">{active?.content}</Div>
    </Div>
  );
}
