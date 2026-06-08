import { Fragment } from 'react';
import { Icon } from '../../components/basic/Icon';
import { Div } from '../../components/basic/Div';
import { Button } from '../../components/basic/Button';
import { optionButtonVariant } from '../../components/composite/mypage/myPageUtils';
import type { ButtonProps } from '../../components/basic/Button';
import { CPAP_OPTION_BUTTON_CLASS } from './cpapSurveyStyles';

function CpapFieldLabelRow({
  label,
  hint,
  icon,
}: {
  label: string;
  hint?: string;
  icon?: string;
}) {
  return (
    <Div className="flex items-center gap-2">
      {icon ? (
        <Icon name={icon} size="sm" className="shrink-0 text-[color:var(--moa-point-color)]" ariaLabel={label} />
      ) : null}
      <Div className="min-w-0 flex-1">
        <Div>{label}</Div>
        {hint ? <Div className="text-muted">{hint}</Div> : null}
      </Div>
    </Div>
  );
}

export type CpapChoiceOption<T extends string> = {
  value: T;
  label: string;
  icon?: string;
};

type CpapChoiceGroupProps<T extends string> = {
  label: string;
  hint?: string;
  labelIcon?: string;
  options: CpapChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
  columns?: 2 | 3 | 4;
  singleRow?: boolean;
  /** 모바일(단일 컬럼)에서 옵션 영역 추가 클래스 — 연령대 2줄 그리드 등 */
  optionsClassName?: string;
};

export function CpapChoiceGroup<T extends string>({
  label,
  hint,
  labelIcon,
  options,
  value,
  onChange,
  columns = 2,
  singleRow = false,
  optionsClassName = '',
}: CpapChoiceGroupProps<T>) {
  const gridClass =
    columns === 4
      ? 'moa-mypage-option-grid grid grid-cols-2 gap-2 @sm:grid-cols-4'
      : columns === 3
        ? 'moa-mypage-option-grid grid grid-cols-3 gap-2'
        : 'moa-mypage-option-grid grid grid-cols-2 gap-2';

  return (
    <Div className="flex flex-col gap-2">
      <CpapFieldLabelRow label={label} hint={hint} icon={labelIcon} />
      <Div
        className={[
          'moa-cpap-choice-options',
          singleRow
            ? 'moa-mypage-option-grid flex flex-nowrap gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
            : gridClass,
          optionsClassName,
        ]
          .filter(Boolean)
          .join(' ')}
        role="group"
        aria-label={label}
      >
        {options.map(option => {
          const selected = value === option.value;
          return (
            <Button
              key={option.value}
              type="button"
              variant={optionButtonVariant(selected)}
              size="medium"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={singleRow ? `${CPAP_OPTION_BUTTON_CLASS} min-w-0 flex-1` : CPAP_OPTION_BUTTON_CLASS}
            >
              {option.icon ? <Icon name={option.icon} size="lg" /> : null}
              <span>{option.label}</span>
            </Button>
          );
        })}
      </Div>
    </Div>
  );
}

export type CpapMaskTypeOption = {
  value: string;
  label: string;
  description: string;
};

export function CpapMaskTypeMultiSelect({
  label,
  labelIcon,
  options,
  values,
  onChange,
}: {
  label: string;
  labelIcon?: string;
  options: CpapMaskTypeOption[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const toggle = (value: string) => {
    onChange(values.includes(value) ? values.filter(v => v !== value) : [...values, value]);
  };

  return (
    <Div className="flex flex-col gap-2">
      <CpapFieldLabelRow label={label} icon={labelIcon} />
      <Div className="moa-cpap-mask-option-grid" role="group" aria-label={label}>
        {options.map(option => {
          const selected = values.includes(option.value);
          return (
            <Button
              key={option.value}
              type="button"
              variant={optionButtonVariant(selected)}
              aria-pressed={selected}
              onClick={() => toggle(option.value)}
              className="moa-cpap-mask-option-btn"
            >
              <Div className="moa-cpap-mask-option-body">
                <Div>{option.label}</Div>
                <Div className={`moa-cpap-mask-option-desc ${selected ? '' : 'text-muted'}`}>{option.description}</Div>
              </Div>
            </Button>
          );
        })}
      </Div>
    </Div>
  );
}

type StepBadgeTone = 'active' | 'done' | 'upcoming';

function stepButtonVariant(tone: StepBadgeTone): NonNullable<ButtonProps['variant']> {
  if (tone === 'active') return 'warning';
  return 'warning-outline';
}

export function CpapProcessBadges({
  steps,
  activeIndex,
  aiReady,
  cameraReadyLabel,
  cameraLoadingLabel,
  onStepClick,
}: {
  steps: { id: string; label: string }[];
  activeIndex: number;
  aiReady: boolean;
  cameraReadyLabel: string;
  cameraLoadingLabel: string;
  onStepClick: (index: number) => void;
}) {
  const stepTone = (index: number): StepBadgeTone => {
    if (index < activeIndex) return 'done';
    if (index === activeIndex) return 'active';
    return 'upcoming';
  };

  return (
    <Fragment>
      <Button
        type="button"
        size="xs"
        variant={aiReady ? 'success-outline' : 'dark-outline'}
        tabIndex={-1}
      >
        <Icon name={aiReady ? 'fa-circle-check' : 'fa-face-viewfinder'} size="sm" />
        {aiReady ? cameraReadyLabel : cameraLoadingLabel}
      </Button>
      <Div className="moa-cpap-process-steps">
        {steps.map((step, index) => {
          const tone = stepTone(index);
          return (
            <Button
              key={step.id}
              type="button"
              size="xs"
              variant={stepButtonVariant(tone)}
              aria-current={tone === 'active' ? 'step' : undefined}
              onClick={() => onStepClick(index)}
            >
              {`STEP${index + 1}.`}
              <span className="moa-cpap-process-step-detail">{step.label}</span>
            </Button>
          );
        })}
      </Div>
    </Fragment>
  );
}

export function CpapPrimaryCta({
  label,
  loadingLabel,
  loading,
  disabled,
  onClick,
}: {
  label: string;
  loadingLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="primary"
      size="medium"
      className={CPAP_OPTION_BUTTON_CLASS}
      onClick={onClick}
      disabled={disabled || loading}
    >
      <Icon name={loading ? 'fa-spinner' : 'fa-camera'} spin={loading} size="lg" />
      {loading && loadingLabel ? loadingLabel : label}
    </Button>
  );
}

export function CpapStatusBanner({
  variant,
  title,
  detail,
}: {
  variant: 'info' | 'error';
  title: string;
  detail?: string;
}) {
  const styles =
    variant === 'error'
      ? 'bg-red-500/10 text-red-800 dark:text-red-200'
      : 'bg-cyan-500/10 text-cyan-900 dark:text-cyan-100';
  const icon = variant === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info';

  return (
    <Div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${styles}`}>
      <Icon name={icon} size="lg" className="shrink-0" />
      <Div className="min-w-0">
        <Div>{title}</Div>
        {detail ? <Div className="text-muted">{detail}</Div> : null}
      </Div>
    </Div>
  );
}

export function CpapCameraOverlayDock({
  status,
  subStatus,
  scanProgress,
}: {
  status: string;
  subStatus?: string;
  scanProgress?: number;
}) {
  const showProgress = scanProgress !== undefined;

  return (
    <Div className="moa-cpap-fit-dock glass-sm-blur rounded-3xl p-4">
      <Div className="flex items-center gap-3">
        <Icon name="fa-face-smile" size="lg" className="shrink-0 text-[color:var(--moa-point-color)]" />
        <Div className="min-w-0 flex-1">
          <Div>{status}</Div>
          {showProgress ? (
            <Div className="moa-cpap-fit-dock-progress">
              <Div className="flex justify-end text-sm">
                <span className="font-bold text-[color:var(--moa-point-color)]">{scanProgress}%</span>
              </Div>
              <Div className="moa-cpap-fit-dock-progress-track">
                <Div className="moa-cpap-fit-dock-progress-fill" style={{ width: `${scanProgress}%` }} />
              </Div>
            </Div>
          ) : subStatus ? (
            <Div className="text-muted">{subStatus}</Div>
          ) : null}
        </Div>
      </Div>
    </Div>
  );
}

export function CpapResultHero({
  badge,
  maskName,
  confidenceLabel,
}: {
  badge: string;
  maskName: string;
  confidenceLabel: string;
}) {
  return (
    <Div className="flex items-start gap-4 rounded-2xl glass-sm px-4 py-4">
      <Div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--moa-point-color)] text-white">
        <Icon name="fa-stethoscope" size="xl" />
      </Div>
      <Div className="min-w-0">
        <Div className="mb-1 inline-flex items-center gap-1 rounded-full glass-sm px-2 py-0.5 text-xs font-bold">
          <Icon name="fa-wand-magic-sparkles" size="sm" />
          {badge}
        </Div>
        <Div className="text-2xl font-bold">{maskName}</Div>
        <Div className="text-muted">{confidenceLabel}</Div>
      </Div>
    </Div>
  );
}

export function CpapEmptyLatest({ message }: { message: string }) {
  return (
    <Div className="flex flex-col items-center gap-2 py-6 text-center text-muted">
      <Icon name="fa-clipboard-list" size="2x" className="opacity-40" />
      <Div>{message}</Div>
    </Div>
  );
}
