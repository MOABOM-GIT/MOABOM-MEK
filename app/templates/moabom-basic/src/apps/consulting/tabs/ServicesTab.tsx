import { useState } from 'react';
import { Div } from '../../../components/basic/Div';
import { Icon } from '../../../components/basic/Icon';
import { Span } from '../../../components/basic/Span';
import { COMPARISON, PATIENT_JOURNEY, SERVICES } from '../consultingContent';

export function ServicesTab() {
  const [activeKey, setActiveKey] = useState(SERVICES[0].key);
  const active = SERVICES.find(s => s.key === activeKey) ?? SERVICES[0];

  return (
    <Div className="moa-consult-section">
      <Div className="moa-consult-card">
        <Div className="moa-consult-card__head">
          <Span className="moa-consult-card__head-icon">
            <Icon name="route" />
          </Span>
          환자 케어 전주기
        </Div>
        <Div className="moa-consult-journey">
          {PATIENT_JOURNEY.map((step, i) => (
            <Div key={step} className="flex items-center gap-1">
              <Span className="moa-consult-journey__step">{step}</Span>
              {i < PATIENT_JOURNEY.length - 1 && (
                <Icon name="chevron-right" size="sm" className="text-muted opacity-60" />
              )}
            </Div>
          ))}
        </Div>
      </Div>

      <Div className="moa-consult-card">
        <Div className="moa-consult-card__head">
          <Span className="moa-consult-card__head-icon">
            <Icon name="layer-group" />
          </Span>
          360° 6대 핵심 서비스
        </Div>
        <Div className="moa-consult-lead">관심 서비스를 선택하면 상세 내용을 확인할 수 있습니다.</Div>

        <Div className="moa-consult-service-grid">
          {SERVICES.map(svc => (
            <button
              key={svc.key}
              type="button"
              className={`moa-consult-service-btn${svc.key === activeKey ? ' is-active' : ''}`}
              onClick={() => setActiveKey(svc.key)}
              aria-pressed={svc.key === activeKey}
            >
              <Icon name={svc.icon} />
              {svc.name}
            </button>
          ))}
        </Div>

        <Div className="moa-consult-service-detail">
          <Div className="moa-consult-feature__icon">
            <Icon name={active.icon} />
          </Div>
          <Div>
            <Div className="moa-consult-kicker">{active.name}</Div>
            <Div className="moa-consult-service-detail__headline">{active.headline}</Div>
            <Div className="moa-consult-lead">{active.description}</Div>
          </Div>
        </Div>
      </Div>

      <Div className="moa-consult-card">
        <Div className="moa-consult-card__head">
          <Span className="moa-consult-card__head-icon">
            <Icon name="scale-balanced" />
          </Span>
          이렇게 달라집니다
        </Div>
        <Div className="moa-consult-compare-list">
          {COMPARISON.map(row => (
            <Div key={row.category} className="moa-consult-compare-row">
              <Div className="moa-consult-compare-row__cat">{row.category}</Div>
              <Div className="moa-consult-compare-row__cell moa-consult-compare-row__cell--before">
                <Icon name="xmark" size="sm" className="mt-0.5 shrink-0 opacity-70" />
                {row.asIs}
              </Div>
              <Div className="moa-consult-compare-row__cell moa-consult-compare-row__cell--after">
                <Icon name="check" size="sm" className="mt-0.5 shrink-0 opacity-80" />
                {row.toBe}
              </Div>
            </Div>
          ))}
        </Div>
      </Div>
    </Div>
  );
}
