import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../components/basic/Button';
import { Div } from '../../components/basic/Div';
import { Icon } from '../../components/basic/Icon';
import { Span } from '../../components/basic/Span';
import { useMoabomSiteDisplayName } from '../../utils/moabomSiteBranding';
import { AppWindowHeader } from '../_shared/AppWindowHeader';
import { APP_WINDOW_BODY_CLASS } from '../appShellTypography';
import { consultingAppMetadata } from './metadata';
import { IntroTab } from './tabs/IntroTab';
import { ServicesTab } from './tabs/ServicesTab';
import { SimulationTab } from './tabs/SimulationTab';
import { ContractTab } from './tabs/ContractTab';
import { SIMULATION_DEFAULTS, type SimulationInput } from './simulationModel';

type ConsultingStep = 'intro' | 'services' | 'simulation' | 'contract';

interface StepDef {
  key: ConsultingStep;
  no: string;
  icon: string;
  label: string;
}

const STEPS: StepDef[] = [
  { key: 'intro', no: '01', icon: 'building', label: '회사 & 비전' },
  { key: 'services', no: '02', icon: 'diagram-project', label: '360 서비스' },
  { key: 'simulation', no: '03', icon: 'chart-line', label: '수익 시뮬레이션' },
  { key: 'contract', no: '04', icon: 'file-signature', label: '전자계약' },
];

export function ConsultingApp() {
  const companyName = useMoabomSiteDisplayName();
  const appRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState<ConsultingStep>('intro');
  const [simInput, setSimInput] = useState<SimulationInput>({ ...SIMULATION_DEFAULTS });

  const stepIndex = STEPS.findIndex(s => s.key === activeStep);

  useEffect(() => {
    appRef.current?.closest('.moa-app-window-viewport')?.scrollTo({ top: 0 });
  }, [activeStep]);

  const goPrev = () => {
    if (stepIndex > 0) setActiveStep(STEPS[stepIndex - 1].key);
  };

  const goNext = () => {
    if (stepIndex < STEPS.length - 1) setActiveStep(STEPS[stepIndex + 1].key);
  };

  const content = useMemo(() => {
    switch (activeStep) {
      case 'intro':
        return <IntroTab />;
      case 'services':
        return <ServicesTab />;
      case 'simulation':
        return (
          <SimulationTab
            hospitalName={companyName}
            input={simInput}
            onInputChange={setSimInput}
            onProceedToContract={() => setActiveStep('contract')}
          />
        );
      case 'contract':
        return <ContractTab hospitalName={companyName} simInput={simInput} />;
      default:
        return null;
    }
  }, [activeStep, companyName, simInput]);

  return (
    <Div ref={appRef} className={`${APP_WINDOW_BODY_CLASS} moa-consulting-app`}>
      <AppWindowHeader
        title="스마트 컨설팅"
        subtitle={`${companyName} — 번거로운 운영은 맡기고, 환자 케어와 수익에 집중하세요`}
        icon={consultingAppMetadata.icon}
        gradient={consultingAppMetadata.gradient}
      />

      <Div className="moa-consult-steps" role="navigation" aria-label="컨설팅 진행 단계">
        {STEPS.map((step, i) => {
          const isActive = step.key === activeStep;
          const isDone = i < stepIndex;
          return (
            <button
              key={step.key}
              type="button"
              className={`moa-consult-step${isActive ? ' is-active' : ''}${isDone ? ' is-done' : ''}`}
              onClick={() => setActiveStep(step.key)}
              aria-current={isActive ? 'step' : undefined}
            >
              <Span className="moa-consult-step__track">
                <Span className="moa-consult-step__dot">
                  {isDone ? <Icon name="check" size="sm" /> : step.no}
                </Span>
                <Span className="moa-consult-step__line" aria-hidden />
              </Span>
              <Span className="moa-consult-step__label">
                <Icon name={step.icon} size="sm" />
                {step.label}
              </Span>
            </button>
          );
        })}
      </Div>

      <Div className="moa-consult-body">{content}</Div>

      <Div className="moa-consult-footer">
        <Button
          variant="secondary"
          size="medium"
          type="button"
          className="moa-consult-btn moa-consult-btn--ghost"
          onClick={goPrev}
          disabled={stepIndex === 0}
        >
          <Icon name="chevron-left" size="sm" /> 이전
        </Button>
        {activeStep !== 'contract' && (
          <Button variant="primary" size="medium" type="button" onClick={goNext}>
            다음 <Icon name="chevron-right" size="sm" />
          </Button>
        )}
      </Div>
    </Div>
  );
}
