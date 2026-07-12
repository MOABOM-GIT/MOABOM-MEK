/**
 * 마이숨 ↔ 스마트케어360 연동 — 개발자 회의용 셸 앱.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../components/basic/Button';
import { Div } from '../../components/basic/Div';
import { Icon } from '../../components/basic/Icon';
import { Span } from '../../components/basic/Span';
import { AppWindowHeader } from '../_shared/AppWindowHeader';
import {
  APP_SHELL_SECTION_TITLE_CLASS,
  APP_STACK_CLASS,
  MOA_GROUP_BORDER_CLASS,
  APP_WINDOW_BODY_CLASS,
} from '../appShellTypography';
import { mysumIntegrationAppMetadata } from './metadata';
import { MYSUM_SECTIONS, type MysumBlock, type MysumSectionKey } from './mysumBriefContent';

interface StepDef {
  key: MysumSectionKey;
  no: string;
  icon: string;
  label: string;
}

const STEPS: StepDef[] = [
  { key: 'agenda', no: '00', icon: 'list', label: '안건·합의' },
  { key: 'systems', no: '01', icon: 'sitemap', label: '역할·시스템' },
  { key: 'data', no: '02', icon: 'database', label: '데이터 정의' },
  { key: 'connect', no: '03', icon: 'diagram-project', label: '연동·할 일' },
  { key: 'access', no: '04', icon: 'user-shield', label: '접근 경계' },
  { key: 'ai-apps', no: '05', icon: 'sparkles', label: 'AI 앱' },
];

const MYSUM_PANEL_CLASS = `glass-sm moa-app-panel ${MOA_GROUP_BORDER_CLASS} p-5 ${APP_STACK_CLASS} moa-mysum-panel`;

function Callout({ tone, text }: NonNullable<MysumBlock['callout']>) {
  const icon =
    tone === 'decided' ? 'check-circle' : tone === 'action' ? 'bullseye' : 'info-circle';
  return (
    <Div className={`moa-mysum-callout moa-mysum-callout--${tone}`}>
      <Span className="moa-mysum-callout__icon" aria-hidden>
        <Icon name={icon} />
      </Span>
      <Div className="moa-mysum-callout__text">{text}</Div>
    </Div>
  );
}

function SideCards({ sides }: { sides: NonNullable<MysumBlock['sides']> }) {
  return (
    <Div className="moa-mysum-sides">
      <Div className="moa-mysum-side moa-mysum-side--mysum">
        <Span className="moa-mysum-side__badge">
          <Icon name="hospital" />
          {sides.mysum.title ?? '마이숨'}
        </Span>
        <ul className="moa-mysum-list">
          {sides.mysum.bullets.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Div>
      <Div className="moa-mysum-side moa-mysum-side--moabom">
        <Span className="moa-mysum-side__badge">
          <Icon name="cloud" />
          {sides.moabom.title ?? '스마트케어360'}
        </Span>
        <ul className="moa-mysum-list">
          {sides.moabom.bullets.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Div>
    </Div>
  );
}

export function MysumIntegrationApp() {
  const appRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<MysumSectionKey>('agenda');
  const stepIndex = STEPS.findIndex(s => s.key === active);
  const section = MYSUM_SECTIONS[active];

  useEffect(() => {
    appRef.current?.closest('.moa-app-window-viewport')?.scrollTo({ top: 0 });
  }, [active]);

  const goPrev = () => {
    if (stepIndex > 0) setActive(STEPS[stepIndex - 1].key);
  };

  const goNext = () => {
    if (stepIndex < STEPS.length - 1) setActive(STEPS[stepIndex + 1].key);
  };

  const blocks = useMemo(() => section.blocks, [section]);

  return (
    <Div ref={appRef} className={`${APP_WINDOW_BODY_CLASS} moa-mysum-app`}>
      <AppWindowHeader
        title={mysumIntegrationAppMetadata.name}
        subtitle="개발자 회의 브리프 · 마이숨 ERP ↔ 스마트케어360"
        icon={mysumIntegrationAppMetadata.icon}
        gradient={mysumIntegrationAppMetadata.gradient}
      />

      <Div className="moa-mysum-steps" role="tablist" aria-label="회의 섹션">
        {STEPS.map(step => (
          <Button
            key={step.key}
            type="button"
            variant="dark-outline"
            size="sm"
            className={`moa-mysum-step ${active === step.key ? 'is-active' : ''}`}
            onClick={() => setActive(step.key)}
          >
            <Span className="moa-mysum-step__no">{step.no}</Span>
            <Icon name={step.icon} />
            <Span className="moa-mysum-step__label">{step.label}</Span>
          </Button>
        ))}
      </Div>

      <Div className={MYSUM_PANEL_CLASS}>
        <Span className={APP_SHELL_SECTION_TITLE_CLASS}>{section.title}</Span>
        {section.lead ? (
          <Div className="moa-mysum-lead">{section.lead}</Div>
        ) : null}

        {blocks.map(block => (
          <Div key={block.id} className="moa-mysum-block moa-app-panel-inner">
            <Span className="moa-mysum-block__title">
              {block.icon ? <Icon name={block.icon} /> : null}
              {block.title}
            </Span>
            {block.callout ? <Callout tone={block.callout.tone} text={block.callout.text} /> : null}
            {block.body ? <Div className="moa-mysum-block__body">{block.body}</Div> : null}
            {block.bullets && block.bullets.length > 0 ? (
              <ul className="moa-mysum-list">
                {block.bullets.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            {block.sides ? <SideCards sides={block.sides} /> : null}
            {block.table ? (
              <Div className="moa-mysum-table-wrap">
                <table className="moa-mysum-table">
                  <thead>
                    <tr>
                      {block.table.headers.map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.table.rows.map((row, idx) => (
                      <tr key={`${block.id}-r${idx}`}>
                        {row.map((cell, cIdx) => (
                          <td key={`${block.id}-c${cIdx}`}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Div>
            ) : null}
            {block.code ? (
              <pre className="moa-mysum-code"><code>{block.code}</code></pre>
            ) : null}
          </Div>
        ))}

        <Div className="moa-mysum-nav" role="navigation" aria-label="섹션 이동">
          <Button type="button" variant="secondary" size="sm" disabled={stepIndex <= 0} onClick={goPrev}>
            <Icon name="chevron-left" />
            이전
          </Button>
          <Span className="moa-mysum-nav__pos">
            {stepIndex + 1} / {STEPS.length}
          </Span>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={stepIndex >= STEPS.length - 1}
            onClick={goNext}
          >
            다음
            <Icon name="chevron-right" />
          </Button>
        </Div>
      </Div>
    </Div>
  );
}
