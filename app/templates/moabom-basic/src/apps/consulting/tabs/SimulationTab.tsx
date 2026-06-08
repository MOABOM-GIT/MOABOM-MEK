import { useMemo } from 'react';
import { Button } from '../../../components/basic/Button';
import { Div } from '../../../components/basic/Div';
import { Icon } from '../../../components/basic/Icon';
import { Span } from '../../../components/basic/Span';
import {
  formatKrwManwon,
  runSimulation,
  type ScenarioResult,
  type SimulationInput,
} from '../simulationModel';

interface FieldDef {
  key: keyof SimulationInput;
  label: string;
  suffix: string;
  step: number;
  min: number;
  max: number;
  /** 비율 필드는 0~1 저장, % 표시 */
  percent?: boolean;
}

const FIELDS: FieldDef[] = [
  { key: 'initialPatients', label: '관리 환자 수(초기)', suffix: '명', step: 10, min: 0, max: 5000 },
  { key: 'monthlyNewPatients', label: '월 처방 수(신규)', suffix: '명', step: 1, min: 0, max: 500 },
  { key: 'staffCount', label: '배치 인력 수', suffix: '명', step: 1, min: 0, max: 50 },
  { key: 'staffSalary', label: '인력 1인 월 급여', suffix: '원', step: 100_000, min: 0, max: 20_000_000 },
  { key: 'equipmentPrice', label: '장비 대당 구매가', suffix: '원', step: 50_000, min: 0, max: 10_000_000 },
  { key: 'refurbishCost', label: '리퍼비시/관리비용', suffix: '원', step: 10_000, min: 0, max: 5_000_000 },
  { key: 'adherencePassRate', label: '순응 통과율', suffix: '%', step: 1, min: 0, max: 100, percent: true },
  { key: 'annualRetention', label: '연간 유지율', suffix: '%', step: 1, min: 0, max: 100, percent: true },
  { key: 'years', label: '시뮬레이션 기간', suffix: '년', step: 1, min: 1, max: 12 },
];

interface SimulationTabProps {
  input: SimulationInput;
  onInputChange: (next: SimulationInput) => void;
  onProceedToContract: () => void;
}

export function SimulationTab({ input, onInputChange, onProceedToContract }: SimulationTabProps) {
  const result = useMemo(() => runSimulation(input), [input]);

  const setField = (field: FieldDef, raw: string) => {
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;
    const value = field.percent ? Math.max(0, Math.min(1, parsed / 100)) : parsed;
    onInputChange({ ...input, [field.key]: value });
  };

  const displayValue = (field: FieldDef) => {
    const v = input[field.key];
    return field.percent ? Math.round(v * 100) : v;
  };

  const selfY5 = result.self.cumulativeEbit[result.self.cumulativeEbit.length - 1] ?? 0;
  const smartY5 = result.smart.cumulativeEbit[result.smart.cumulativeEbit.length - 1] ?? 0;
  const advantage = smartY5 - selfY5;

  return (
    <Div className="flex flex-col gap-4">
      {/* 입력: 병원 운영 변수 설정 */}
      <Div className="moa-group rounded-3xl border border-white/55 p-5 shadow-sm dark:border-white/12">
        <Div className="flex items-center gap-2 text-base font-bold text-primary">
          <Icon name="sliders" className="text-sky-500" /> 병원 운영 변수 설정
        </Div>
        <Div className="mt-3 grid grid-cols-1 gap-3 @md:grid-cols-3">
          {FIELDS.map(field => (
            <label key={field.key} className="flex flex-col gap-1">
              <Span className="text-xs font-bold text-muted">{field.label}</Span>
              <Div className="flex items-center gap-1 rounded-xl border border-black/10 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-800">
                <input
                  type="number"
                  className="w-full bg-transparent text-right text-sm font-bold text-primary outline-none"
                  value={displayValue(field)}
                  step={field.step}
                  min={field.min}
                  max={field.max}
                  onChange={e => setField(field, e.target.value)}
                />
                <Span className="shrink-0 text-xs font-bold text-muted">{field.suffix}</Span>
              </Div>
            </label>
          ))}
        </Div>
        <Div className="mt-3 text-xs leading-relaxed text-muted">
          입력값을 활용해 기존 <Span className="font-bold">자체운영방식</Span>과 <Span className="font-bold">smart care 360</Span> 도입 시
          {' '}{input.years}개년 EBIT(영업이익) 추세를 실시간으로 비교합니다. (값을 바꾸면 즉시 갱신)
        </Div>
      </Div>

      {/* 핵심 결과 카드 */}
      <Div className="grid grid-cols-1 gap-3 @md:grid-cols-2">
        <ScenarioCard
          tone="self"
          title="비 도입 상태 (자체 운영)"
          subtitle="기존 인력 중심 시스템 및 아날로그 방식 지속 운영 시"
          scenario={result.self}
        />
        <ScenarioCard
          tone="smart"
          title="smart care 360 도입"
          subtitle="스마트케어360 시스템 도입으로 초기 안정성·수익성 도모"
          scenario={result.smart}
        />
      </Div>

      {/* EBIT 추세 비교 차트 */}
      <Div className="moa-group rounded-3xl border border-white/55 p-5 shadow-sm dark:border-white/12">
        <Div className="text-base font-bold text-primary">Y1 ~ Y{input.years} 영업이익(EBIT) 트렌드 비교</Div>
        <EbitTrendChart self={result.self} smart={result.smart} />
        <Div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
          <Span className="flex items-center gap-1.5"><Span className="inline-block h-3 w-3 rounded-sm bg-rose-400" /> 자체 운영</Span>
          <Span className="flex items-center gap-1.5"><Span className="inline-block h-3 w-3 rounded-sm bg-blue-500" /> smart care 360</Span>
        </Div>
      </Div>

      {/* 결론 + 계약 진행 */}
      <Div className="rounded-3xl bg-gradient-to-br from-blue-600 to-sky-500 p-5 text-white shadow-lg">
        <Div className="flex items-center gap-2 text-sm font-bold text-white/80">
          <Icon name="trophy" /> {input.years}개년 누적 영업이익 차이
        </Div>
        <Div className="mt-1 text-3xl font-extrabold">{formatKrwManwon(advantage)} 우위</Div>
        <Div className="mt-1 text-sm text-white/85">
          smart care 360 도입 시 누적 EBIT {formatKrwManwon(smartY5)} vs 자체 운영 {formatKrwManwon(selfY5)}
        </Div>
        <Button
          variant="neutral"
          size="large"
          className="mt-4 w-full !rounded-2xl"
          onClick={onProceedToContract}
        >
          <Icon name="file-signature" className="mr-2" /> 이 조건으로 전자계약 진행하기
        </Button>
      </Div>
    </Div>
  );
}

function ScenarioCard({
  tone,
  title,
  subtitle,
  scenario,
}: {
  tone: 'self' | 'smart';
  title: string;
  subtitle: string;
  scenario: ScenarioResult;
}) {
  const isSmart = tone === 'smart';
  const y1 = scenario.yearly[0]?.ebit ?? 0;
  const y3 = scenario.yearly[2]?.ebit ?? 0;
  const cumY5 = scenario.cumulativeEbit[scenario.cumulativeEbit.length - 1] ?? 0;
  const breakeven = scenario.breakevenMonth;

  return (
    <Div
      className={`rounded-3xl border p-5 shadow-sm ${
        isSmart
          ? 'border-blue-300 bg-blue-500/5 dark:border-blue-500/40'
          : 'border-rose-200 bg-rose-500/5 dark:border-rose-500/30'
      }`}
    >
      <Div className="flex items-center gap-2">
        <Icon name={isSmart ? 'rocket' : 'triangle-exclamation'} className={isSmart ? 'text-blue-500' : 'text-rose-500'} />
        <Span className="text-base font-bold text-primary">{title}</Span>
      </Div>
      <Div className="mt-1 text-xs leading-snug text-muted">{subtitle}</Div>

      <Div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Metric label="1년차 EBIT" value={y1} />
        <Metric label="3년차 EBIT" value={y3} />
        <Metric label="누적 EBIT" value={cumY5} highlight={isSmart} />
      </Div>

      <Div className="mt-3 flex items-center gap-2 rounded-xl bg-black/5 px-3 py-2 text-xs dark:bg-white/5">
        <Icon name={breakeven ? 'check-circle' : 'clock'} size="sm" className={breakeven ? 'text-emerald-500' : 'text-amber-500'} />
        <Span className="text-muted">
          손익분기:{' '}
          <Span className="font-bold text-primary">
            {breakeven ? `${Math.ceil(breakeven / 12)}년차 (${breakeven}개월)` : '기간 내 미도달'}
          </Span>
        </Span>
      </Div>
    </Div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  const negative = value < 0;
  return (
    <Div className="rounded-xl bg-white/60 px-2 py-2 dark:bg-slate-800/60">
      <Div className="text-xs font-bold text-muted">{label}</Div>
      <Div className={`mt-0.5 text-sm font-extrabold ${negative ? 'text-rose-600 dark:text-rose-400' : highlight ? 'text-blue-600 dark:text-blue-400' : 'text-primary'}`}>
        {formatKrwManwon(value)}
      </Div>
    </Div>
  );
}

function EbitTrendChart({ self, smart }: { self: ScenarioResult; smart: ScenarioResult }) {
  const years = self.yearly.length;
  const allValues = [...self.yearly.map(y => y.ebit), ...smart.yearly.map(y => y.ebit), 0];
  const max = Math.max(...allValues);
  const min = Math.min(...allValues);
  const range = Math.max(1, max - min);
  const zeroRatio = (max - 0) / range; // 상단 기준 0선 위치 비율
  const chartHeight = 160;

  const barHeight = (v: number) => (Math.abs(v) / range) * chartHeight;

  return (
    <Div className="relative mt-4" style={{ height: `${chartHeight}px` }}>
      {/* 0 기준선 */}
      <Div
        className="absolute left-0 right-0 border-t border-dashed border-black/20 dark:border-white/20"
        style={{ top: `${zeroRatio * chartHeight}px` }}
      />
      <Div className="flex h-full items-stretch gap-2">
        {Array.from({ length: years }).map((_, i) => {
          const sv = self.yearly[i].ebit;
          const mv = smart.yearly[i].ebit;
          return (
            <Div key={i} className="flex flex-1 flex-col items-center">
              <Div className="relative w-full flex-1">
                <Bar value={sv} color="bg-rose-400" chartHeight={chartHeight} zeroRatio={zeroRatio} barHeight={barHeight} side="left" />
                <Bar value={mv} color="bg-blue-500" chartHeight={chartHeight} zeroRatio={zeroRatio} barHeight={barHeight} side="right" />
              </Div>
              <Span className="mt-1 text-xs font-bold text-muted">Y{i + 1}</Span>
            </Div>
          );
        })}
      </Div>
    </Div>
  );
}

function Bar({
  value,
  color,
  chartHeight,
  zeroRatio,
  barHeight,
  side,
}: {
  value: number;
  color: string;
  chartHeight: number;
  zeroRatio: number;
  barHeight: (v: number) => number;
  side: 'left' | 'right';
}) {
  const h = barHeight(value);
  const zeroY = zeroRatio * chartHeight;
  const top = value >= 0 ? zeroY - h : zeroY;
  return (
    <Div
      className={`absolute ${color} rounded-md opacity-90`}
      style={{
        height: `${Math.max(2, h)}px`,
        top: `${top}px`,
        width: '42%',
        left: side === 'left' ? '4%' : '54%',
      }}
      title={value.toLocaleString()}
    />
  );
}
