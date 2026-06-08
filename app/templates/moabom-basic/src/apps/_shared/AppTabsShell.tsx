import type { ReactNode } from 'react';
import { Button } from '../../components/basic/Button';
import { Div } from '../../components/basic/Div';
import { Icon } from '../../components/basic/Icon';
import { Span } from '../../components/basic/Span';

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
    <Div className="flex min-h-full flex-col">
      {/* 헤더 */}
      <Div className="rounded-3xl p-5 text-white shadow-lg" style={{ background: gradient }}>
        <Div className="flex items-center gap-3">
          <Div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
            <Icon name={icon} className="text-2xl text-white" />
          </Div>
          <Div>
            <Div className="text-xl font-bold leading-tight">{title}</Div>
            {subtitle && <Div className="text-sm text-white/80">{subtitle}</Div>}
          </Div>
        </Div>
      </Div>

      {/* 탭 바 */}
      <Div className="mt-4 grid grid-cols-2 gap-2 @lg:grid-cols-4">
        {tabs.map(tab => {
          const isActive = tab.key === active?.key;
          return (
            <Button
              key={tab.key}
              variant={isActive ? 'primary' : 'secondary'}
              onClick={() => onActiveKeyChange(tab.key)}
              className="flex h-auto flex-col items-start gap-1 !rounded-2xl !px-4 !py-3 text-left"
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
      <Div className="mt-4 flex-1">{active?.content}</Div>
    </Div>
  );
}
