import { useState } from 'react';
import { Div } from '../../../components/basic/Div';
import { Icon } from '../../../components/basic/Icon';
import { Span } from '../../../components/basic/Span';
import { APP_STACK_CLASS, APP_STACK_GRID_CLASS } from '../../appShellTypography';
import { CONSULTING_HERO_GRADIENT, CONSULTING_MINT_TEXT, CONSULTING_ORANGE_TEXT, CONSULTING_PANEL } from '../consultingTheme';
import { COMPARISON, PATIENT_JOURNEY, SERVICES } from '../consultingContent';

export function ServicesTab() {
  const [activeKey, setActiveKey] = useState(SERVICES[0].key);
  const active = SERVICES.find(s => s.key === activeKey) ?? SERVICES[0];

  return (
    <Div className={APP_STACK_CLASS}>
      <Div className={CONSULTING_PANEL}>
        <Div className="text-lg font-bold text-primary">환자 케어 전주기</Div>
        <Div className="flex flex-wrap items-center gap-2">
          {PATIENT_JOURNEY.map((step, i) => (
            <Div key={step} className="flex items-center gap-2">
              <Span className="rounded-full bg-[#27bfc1]/12 px-4 py-2 text-sm font-bold text-[#0f2d3a] dark:text-[#9de7e8]">{step}</Span>
              {i < PATIENT_JOURNEY.length - 1 && <Icon name="chevron-right" size="sm" className="text-muted" />}
            </Div>
          ))}
        </Div>
      </Div>

      <Div className={CONSULTING_PANEL}>
        <Div className={APP_STACK_CLASS}>
          <Div className="text-lg font-bold text-primary">360° 6대 핵심 서비스</Div>
          <Div className="text-base text-muted">관심 서비스를 눌러 상세 내용을 확인해 보세요.</Div>

          <Div className={`${APP_STACK_GRID_CLASS} grid grid-cols-2 @md:grid-cols-3 @lg:grid-cols-6`}>
            {SERVICES.map(svc => {
              const on = svc.key === activeKey;
              return (
                <button
                  key={svc.key}
                  type="button"
                  onClick={() => setActiveKey(svc.key)}
                  className={`flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-2xl border p-4 transition ${
                    on
                      ? 'border-[#479ee2] bg-[#479ee2] text-white shadow-sm'
                      : 'border-transparent bg-slate-900/5 text-muted hover:bg-slate-900/8 dark:bg-[#479ee2]/8'
                  }`}
                  aria-pressed={on}
                >
                  <Icon name={svc.icon} className="text-xl" />
                  <Span className="text-sm font-bold">{svc.name}</Span>
                </button>
              );
            })}
          </Div>

          <Div className={`rounded-2xl p-6 shadow-sm ${CONSULTING_HERO_GRADIENT}`}>
            <Div className="flex items-start gap-4">
              <Div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white ring-1 ring-white/30">
                <Icon name={active.icon} className="text-2xl" />
              </Div>
              <Div>
                <Div className="text-sm font-semibold text-white/80">{active.name}</Div>
                <Div className="mt-1 text-xl font-extrabold leading-snug">{active.headline}</Div>
                <Div className="mt-3 text-base leading-relaxed text-white/85">{active.description}</Div>
              </Div>
            </Div>
          </Div>
        </Div>
      </Div>

      <Div className={CONSULTING_PANEL}>
        <Div className={APP_STACK_CLASS}>
          <Div className="text-lg font-bold text-primary">이렇게 달라집니다</Div>
          <Div className={`${APP_STACK_GRID_CLASS} grid grid-cols-12 text-sm font-bold text-muted`}>
            <Div className="col-span-2">구분</Div>
            <Div className="col-span-5">지금 방식</Div>
            <Div className="col-span-5 text-[#87c426] dark:text-[#a7dd58]">스마트케어 360</Div>
          </Div>
          <Div className={APP_STACK_CLASS}>
            {COMPARISON.map(row => (
              <Div key={row.category} className={`${APP_STACK_GRID_CLASS} grid grid-cols-12 items-stretch`}>
                <Div className="col-span-2 flex items-center rounded-xl bg-slate-900/5 px-3 py-3 text-sm font-bold text-primary dark:bg-[#479ee2]/8">{row.category}</Div>
                <Div className={`col-span-5 flex items-center rounded-xl border border-[#fe8540]/30 bg-[#fe8540]/8 px-4 py-3 text-sm leading-snug ${CONSULTING_ORANGE_TEXT}`}>
                  <Icon name="xmark" size="sm" className="mr-2 shrink-0 opacity-70" />{row.asIs}
                </Div>
                <Div className={`col-span-5 flex items-center rounded-xl border border-[#27bfc1]/30 bg-[#27bfc1]/8 px-4 py-3 text-sm leading-snug ${CONSULTING_MINT_TEXT}`}>
                  <Icon name="check" size="sm" className="mr-2 shrink-0 opacity-80" />{row.toBe}
                </Div>
              </Div>
            ))}
          </Div>
        </Div>
      </Div>
    </Div>
  );
}
