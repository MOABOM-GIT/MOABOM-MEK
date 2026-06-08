import { useState } from 'react';
import { Div } from '../../../components/basic/Div';
import { Icon } from '../../../components/basic/Icon';
import { Span } from '../../../components/basic/Span';
import { COMPARISON, PATIENT_JOURNEY, SERVICES } from '../consultingContent';

export function ServicesTab() {
  const [activeKey, setActiveKey] = useState(SERVICES[0].key);
  const active = SERVICES.find(s => s.key === activeKey) ?? SERVICES[0];

  return (
    <Div className="flex flex-col gap-4">
      {/* 환자 케어 전주기 여정 */}
      <Div className="moa-group rounded-3xl border border-white/55 p-5 shadow-sm dark:border-white/12">
        <Div className="text-base font-bold text-primary">환자 케어 전주기</Div>
        <Div className="mt-3 flex flex-wrap items-center gap-1">
          {PATIENT_JOURNEY.map((step, i) => (
            <Div key={step} className="flex items-center gap-1">
              <Span className="rounded-full bg-blue-600/10 px-3 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-300">{step}</Span>
              {i < PATIENT_JOURNEY.length - 1 && <Icon name="chevron-right" size="sm" className="text-muted" />}
            </Div>
          ))}
        </Div>
      </Div>

      {/* 6대 핵심 서비스 — 노드 선택 */}
      <Div className="moa-group rounded-3xl border border-white/55 p-5 shadow-sm dark:border-white/12">
        <Div className="text-base font-bold text-primary">360° 6대 핵심 서비스</Div>
        <Div className="mt-1 text-sm text-muted">서비스 노드를 선택하면 상세 내용을 확인할 수 있습니다.</Div>

        <Div className="mt-4 grid grid-cols-3 gap-2 @md:grid-cols-6">
          {SERVICES.map(svc => {
            const on = svc.key === activeKey;
            return (
              <button
                key={svc.key}
                type="button"
                onClick={() => setActiveKey(svc.key)}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 transition ${
                  on
                    ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                    : 'border-transparent bg-black/5 text-muted hover:bg-black/10 dark:bg-white/5'
                }`}
                aria-pressed={on}
              >
                <Icon name={svc.icon} className="text-lg" />
                <Span className="text-xs font-bold">{svc.name}</Span>
              </button>
            );
          })}
        </Div>

        {/* 선택된 서비스 상세 */}
        <Div className="mt-4 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 p-5 text-white">
          <Div className="flex items-center gap-3">
            <Icon name={active.icon} className="text-2xl" />
            <Div>
              <Div className="text-xs font-bold text-white/80">{active.name}</Div>
              <Div className="text-lg font-extrabold">{active.headline}</Div>
            </Div>
          </Div>
          <Div className="mt-2 text-sm leading-relaxed text-white/90">{active.description}</Div>
        </Div>
      </Div>

      {/* 서비스 비교 분석 */}
      <Div className="moa-group rounded-3xl border border-white/55 p-5 shadow-sm dark:border-white/12">
        <Div className="text-base font-bold text-primary">서비스 비교 분석</Div>
        <Div className="mt-3 grid grid-cols-12 gap-2 text-xs font-bold text-muted">
          <Div className="col-span-2">구분</Div>
          <Div className="col-span-5">병원 (AS IS)</Div>
          <Div className="col-span-5 text-blue-600 dark:text-blue-400">360 (TO BE)</Div>
        </Div>
        <Div className="mt-1 flex flex-col gap-2">
          {COMPARISON.map(row => (
            <Div key={row.category} className="grid grid-cols-12 items-stretch gap-2">
              <Div className="col-span-2 flex items-center rounded-xl bg-black/5 px-2 py-2 text-xs font-bold text-primary dark:bg-white/5">{row.category}</Div>
              <Div className="col-span-5 flex items-center rounded-xl bg-rose-500/5 px-3 py-2 text-xs leading-snug text-rose-700 dark:text-rose-300">
                <Icon name="xmark" size="sm" className="mr-1 shrink-0" />{row.asIs}
              </Div>
              <Div className="col-span-5 flex items-center rounded-xl bg-emerald-500/10 px-3 py-2 text-xs leading-snug text-emerald-700 dark:text-emerald-300">
                <Icon name="check" size="sm" className="mr-1 shrink-0" />{row.toBe}
              </Div>
            </Div>
          ))}
        </Div>
      </Div>
    </Div>
  );
}
