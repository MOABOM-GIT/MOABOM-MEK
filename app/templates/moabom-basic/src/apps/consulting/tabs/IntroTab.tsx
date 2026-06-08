import { Div } from '../../../components/basic/Div';
import { Icon } from '../../../components/basic/Icon';
import { Span } from '../../../components/basic/Span';
import { COMPANY, COMPETENCIES } from '../consultingContent';

export function IntroTab() {
  return (
    <Div className="flex flex-col gap-4">
      {/* 회사 개요 */}
      <Div className="moa-group rounded-3xl border border-white/55 p-5 shadow-sm dark:border-white/12">
        <Div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400">
          <Icon name="circle-info" size="sm" /> About MEK Healthcare
        </Div>
        <Div className="mt-1 text-2xl font-extrabold text-primary">{COMPANY.name}</Div>
        <Div className="mt-1 text-sm text-muted">{COMPANY.tagline}</Div>

        <Div className="mt-4 grid grid-cols-1 gap-2 @md:grid-cols-2">
          {COMPANY.facts.map(fact => (
            <Div key={fact.label} className="flex items-center justify-between rounded-2xl bg-black/5 px-4 py-3 dark:bg-white/5">
              <Span className="text-sm font-bold text-muted">{fact.label}</Span>
              <Span className="text-sm font-bold text-primary">{fact.value}</Span>
            </Div>
          ))}
        </Div>
      </Div>

      {/* 전국 네트워크 */}
      <Div className="moa-group rounded-3xl border border-white/55 p-5 shadow-sm dark:border-white/12">
        <Div className="flex items-center gap-2 text-base font-bold text-primary">
          <Icon name="map-location-dot" className="text-sky-500" /> 전국 네트워크
        </Div>
        <Div className="mt-2 text-sm leading-relaxed text-muted">{COMPANY.network}</Div>
        <Div className="mt-3 flex flex-wrap gap-2">
          {COMPANY.branches.map(branch => (
            <Span key={branch} className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-700 dark:text-sky-300">
              <Icon name="location-dot" size="sm" className="mr-1" />{branch}
            </Span>
          ))}
        </Div>
      </Div>

      {/* 핵심 역량 */}
      <Div className="flex flex-col gap-3">
        <Div className="px-1 text-base font-bold text-primary">Core Competencies</Div>
        {COMPETENCIES.map(item => (
          <Div key={item.title} className="moa-group flex gap-4 rounded-3xl border border-white/55 p-4 shadow-sm dark:border-white/12">
            <Div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white">
              <Icon name={item.icon} className="text-xl" />
            </Div>
            <Div>
              <Div className="text-base font-bold text-primary">{item.title}</Div>
              <Div className="mt-1 text-sm leading-relaxed text-muted">{item.description}</Div>
            </Div>
          </Div>
        ))}
      </Div>
    </Div>
  );
}
