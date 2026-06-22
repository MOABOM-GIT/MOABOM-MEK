import { Div } from '../../../components/basic/Div';
import { Icon } from '../../../components/basic/Icon';
import { Span } from '../../../components/basic/Span';
import { COMPANY, COMPETENCIES } from '../consultingContent';

export function IntroTab() {
  return (
    <Div className="moa-consult-section">
      <Div className="moa-consult-card moa-consult-card--accent">
        <Div className="moa-consult-kicker">About MEK Healthcare</Div>
        <Div className="moa-consult-title">{COMPANY.name}</Div>
        <Div className="moa-consult-lead">{COMPANY.tagline}</Div>

        <Div className="moa-consult-stat-grid">
          {COMPANY.facts.map(fact => (
            <Div key={fact.label} className="moa-consult-stat">
              <Div className="moa-consult-stat__label">{fact.label}</Div>
              <Div className="moa-consult-stat__value">{fact.value}</Div>
            </Div>
          ))}
        </Div>
      </Div>

      <Div className="moa-consult-card">
        <Div className="moa-consult-card__head">
          <Span className="moa-consult-card__head-icon">
            <Icon name="map-location-dot" />
          </Span>
          전국 네트워크
        </Div>
        <Div className="moa-consult-lead">{COMPANY.network}</Div>
        <Div className="moa-consult-chips">
          {COMPANY.branches.map(branch => (
            <Span key={branch} className="moa-consult-chip">
              <Icon name="location-dot" size="sm" />
              {branch}
            </Span>
          ))}
        </Div>
      </Div>

      <Div className="moa-consult-card">
        <Div className="moa-consult-card__head">
          <Span className="moa-consult-card__head-icon">
            <Icon name="star" />
          </Span>
          핵심 역량
        </Div>
        <Div className="moa-consult-feature-list">
          {COMPETENCIES.map(item => (
            <Div key={item.title} className="moa-consult-feature">
              <Div className="moa-consult-feature__icon">
                <Icon name={item.icon} />
              </Div>
              <Div>
                <Div className="moa-consult-feature__title">{item.title}</Div>
                <Div className="moa-consult-feature__desc">{item.description}</Div>
              </Div>
            </Div>
          ))}
        </Div>
      </Div>
    </Div>
  );
}
