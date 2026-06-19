import { Div } from '../../../components/basic/Div';
import { Icon } from '../../../components/basic/Icon';
import { Span } from '../../../components/basic/Span';
import { APP_STACK_CLASS, APP_STACK_GRID_CLASS } from '../../appShellTypography';
import { CONSULTING_ACCENT, CONSULTING_ICON_TILE, CONSULTING_PANEL } from '../consultingTheme';
import { COMPANY, COMPETENCIES } from '../consultingContent';

export function IntroTab() {
  return (
    <Div className={APP_STACK_CLASS}>
      <Div className={CONSULTING_PANEL}>
        <Div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wide ${CONSULTING_ACCENT}`}>
          <Icon name="circle-info" size="sm" /> About MEK Healthcare
        </Div>
        <Div className={APP_STACK_CLASS}>
          <Div className="text-2xl font-extrabold tracking-tight text-primary">{COMPANY.name}</Div>
          <Div className="text-base leading-relaxed text-muted">{COMPANY.tagline}</Div>

          <Div className={`${APP_STACK_GRID_CLASS} grid grid-cols-1 @md:grid-cols-2`}>
            {COMPANY.facts.map(fact => (
              <Div key={fact.label} className="flex items-center justify-between rounded-2xl bg-[#27bfc1]/8 px-5 py-3.5 dark:bg-[#27bfc1]/10">
                <Span className="text-sm font-bold text-muted">{fact.label}</Span>
                <Span className="text-sm font-bold text-primary">{fact.value}</Span>
              </Div>
            ))}
          </Div>
        </Div>
      </Div>

      <Div className={CONSULTING_PANEL}>
        <Div className="flex items-center gap-2 text-lg font-bold text-primary">
          <Icon name="map-location-dot" className="text-[#479ee2]" /> 전국 네트워크
        </Div>
        <Div className={APP_STACK_CLASS}>
          <Div className="text-base leading-relaxed text-muted">{COMPANY.network}</Div>
          <Div className="flex flex-wrap gap-2">
            {COMPANY.branches.map(branch => (
              <Span key={branch} className="rounded-full bg-[#87c426]/12 px-3.5 py-1.5 text-xs font-bold text-[#4f7f12] dark:text-[#a7dd58]">
                <Icon name="location-dot" size="sm" className="mr-1" />{branch}
              </Span>
            ))}
          </Div>
        </Div>
      </Div>

      <Div className={APP_STACK_CLASS}>
        <Div className="px-1 text-lg font-bold text-primary">핵심 역량</Div>
        {COMPETENCIES.map(item => (
          <Div key={item.title} className={`${CONSULTING_PANEL} flex gap-5`}>
            <Div className={`${CONSULTING_ICON_TILE} h-14 w-14`}>
              <Icon name={item.icon} className="text-xl" />
            </Div>
            <Div>
              <Div className="text-lg font-bold text-primary">{item.title}</Div>
              <Div className="mt-2 text-base leading-relaxed text-muted">{item.description}</Div>
            </Div>
          </Div>
        ))}
      </Div>
    </Div>
  );
}
