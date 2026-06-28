import { useMemo } from 'react';
import { Button } from '../../../components/basic/Button';
import { Div } from '../../../components/basic/Div';
import { Icon } from '../../../components/basic/Icon';
import { Span } from '../../../components/basic/Span';
import { EbitChartPanels } from '../EbitChartPanels';
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
  hospitalName: string;
  input: SimulationInput;
  onInputChange: (next: SimulationInput) => void;
  onProceedToContract: () => void;
}

export function SimulationTab({ hospitalName, input, onInputChange, onProceedToContract }: SimulationTabProps) {
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
    <Div className="moa-consult-section">
      <section className="moa-consult-card">
        <Div className="moa-consult-card__head">
          <span className="moa-consult-card__head-icon">
            <Icon name="sliders" />
          </span>
          {hospitalName} 운영 변수
        </Div>
        <Div className="moa-consult-field-grid">
          {FIELDS.map(field => (
            <Div key={field.key} className="moa-consult-field">
              <label>
                <span className="moa-consult-field__label">{field.label}</span>
                <span className="moa-consult-field__control">
                  <input
                    type="number"
                    value={displayValue(field)}
                    step={field.step}
                    min={field.min}
                    max={field.max}
                    onChange={e => setField(field, e.target.value)}
                  />
                  <span className="moa-consult-field__suffix">{field.suffix}</span>
                </span>
              </label>
            </Div>
          ))}
        </Div>
        <p className="moa-consult-lead">
          직접 운영과 <Span className="font-bold text-primary">스마트케어360</Span>을 {input.years}년 기준으로 비교합니다. 숫자를 바꾸면 즉시 반영됩니다.
        </p>
      </section>

      <Div className="moa-consult-scenario-grid">
        <ScenarioCard
          tone="self"
          title="직접 운영"
          subtitle="인력·장비·청구를 업체에서 직접 챙기는 경우"
          scenario={result.self}
        />
        <ScenarioCard
          tone="smart"
          title="스마트케어360"
          subtitle="렌탈·환자관리·청구·교육까지 전문 인프라에 맡기는 경우"
          scenario={result.smart}
        />
      </Div>

      <Div className="moa-consult-card">
        <Div className="moa-consult-card__head">
          <Span className="moa-consult-card__head-icon">
            <Icon name="chart-column" />
          </Span>
          Y1 ~ Y{input.years} EBIT 트렌드
        </Div>
        <EbitChartPanels self={result.self} smart={result.smart} />
        <Div className="moa-consult-legend">
          <Span className="moa-consult-legend__item">
            <Span className="moa-consult-legend__swatch moa-consult-legend__swatch--self" /> 직접 운영
          </Span>
          <Span className="moa-consult-legend__item">
            <Span className="moa-consult-legend__swatch moa-consult-legend__swatch--smart" /> 스마트케어360
          </Span>
        </Div>
      </Div>

      <section className="moa-consult-card moa-consult-card--accent">
        <Div className="moa-consult-kicker">
          <Icon name="trophy" size="sm" className="mr-1" />
          {input.years}년 누적 이익 차이
        </Div>
        <Div className="moa-consult-advantage">
          <Div className="moa-consult-advantage__value">{formatKrwManwon(advantage)} 더 유리</Div>
          <p className="moa-consult-lead">
            스마트케어360 {formatKrwManwon(smartY5)} · 직접 운영 {formatKrwManwon(selfY5)}
          </p>
        </Div>
        <Button
          variant="primary"
          type="button"
          className="moa-consult-btn moa-consult-btn--primary moa-consult-btn--wide"
          onClick={onProceedToContract}
        >
          <Icon name="file-signature" size="sm" /> 이 조건으로 전자계약 진행
        </Button>
      </section>
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
    <article className={`moa-consult-scenario${isSmart ? ' moa-consult-scenario--smart' : ''}`}>
      <Div className="moa-consult-scenario__title">
        <Icon name={isSmart ? 'rocket' : 'triangle-exclamation'} />
        {title}
      </Div>
      <p className="moa-consult-scenario__subtitle">{subtitle}</p>

      <Div className="moa-consult-metrics">
        <Metric label="1년차 EBIT" value={y1} highlight={isSmart} />
        <Metric label="3년차 EBIT" value={y3} highlight={isSmart} />
        <Metric label="누적 EBIT" value={cumY5} highlight={isSmart} />
      </Div>

        <Div className="moa-consult-breakeven">
        <Icon name={breakeven ? 'check-circle' : 'clock'} size="sm" className={breakeven ? 'text-emerald-500' : 'text-orange-500'} />
        손익분기:{' '}
        <Span className="font-bold">
          {breakeven ? `${Math.ceil(breakeven / 12)}년차 (${breakeven}개월)` : '기간 내 미도달'}
        </Span>
      </Div>
    </article>
  );
}

function Metric({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  const negative = value < 0;
  const valueClass = negative
    ? 'is-negative'
    : highlight && value > 0
      ? 'is-positive'
      : '';

  return (
    <Div className="moa-consult-metric">
      <Div className="moa-consult-metric__label">{label}</Div>
      <Div className={`moa-consult-metric__value ${valueClass}`}>{formatKrwManwon(value)}</Div>
    </Div>
  );
}
