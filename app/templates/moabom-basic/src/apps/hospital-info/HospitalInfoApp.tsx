import { A } from '../../components/basic/A';
import { Div } from '../../components/basic/Div';
import { Icon } from '../../components/basic/Icon';
import { Span } from '../../components/basic/Span';
import { APP_WINDOW_BODY_CLASS } from '../appShellTypography';
import { getMoabomShellBootData } from '../../runtime/moabomShellBoot';
import { useMoabomSiteDisplayName } from '../../utils/moabomSiteBranding';
import { hospitalInfoAppMetadata } from './metadata';

function splitDescription(raw: string): { intro: string; address: string } {
  const parts = raw.split(' · ').map(part => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { intro: parts.slice(0, -1).join(' · '), address: parts[parts.length - 1] };
  }
  return { intro: raw.trim(), address: '' };
}

function buildGoogleMapsSearchUrl(address: string): string {
  const query = encodeURIComponent(address);

  return `https://www.google.com/maps?q=${query}`;
}

export function HospitalInfoApp() {
  const hospitalName = useMoabomSiteDisplayName();
  const site = getMoabomShellBootData()?.site;
  const description = typeof site?.site_description === 'string' ? site.site_description : '';
  const fallback = splitDescription(description);
  const intro = typeof site?.site_note === 'string' && site.site_note.trim() !== ''
    ? site.site_note.trim()
    : fallback.intro;
  const address = typeof site?.site_address === 'string' && site.site_address.trim() !== ''
    ? site.site_address.trim()
    : fallback.address;
  const siteUrl = typeof site?.site_url === 'string' ? site.site_url.trim() : '';
  const displayIntro = intro || '병원소개 정보가 아직 입력되지 않았습니다.';
  const displayAddress = address || '찾아오시는길 정보가 아직 입력되지 않았습니다.';
  const mapsUrl = address ? buildGoogleMapsSearchUrl(address) : '';
  const mapsEmbedUrl = mapsUrl ? `${mapsUrl}&output=embed` : '';

  return (
    <Div className={`${APP_WINDOW_BODY_CLASS} hospital-info-app`}>
      <Div
        className="hospital-info-hero"
        style={{ background: hospitalInfoAppMetadata.gradient }}
      >
        <Div className="hospital-info-hero-content">
          <Div className="hospital-info-hero-icon">
            <Icon name={hospitalInfoAppMetadata.icon} className="text-white" />
          </Div>
          <Div className="hospital-info-hero-title">
            <Div className="hospital-info-hero-name">{hospitalName}</Div>
            <Div className="hospital-info-hero-subtitle">
              병원소개 및 찾아오시는길
            </Div>
          </Div>
        </Div>
      </Div>

      <Div className="hospital-info-grid">
        <Div className="hospital-info-card">
          <Span className="hospital-info-card-title">
            <Icon name="building" />
            병원소개
          </Span>
          <Div className="hospital-info-name">{hospitalName}</Div>
          <Div className="hospital-info-text">{displayIntro}</Div>
        </Div>

        <Div className="hospital-info-card">
          <Span className="hospital-info-card-title">
            <Icon name="map-marker" />
            찾아오시는길
          </Span>
          <Div className="hospital-info-address">{displayAddress}</Div>
          {siteUrl ? (
            <Div className="hospital-info-url">{siteUrl}</Div>
          ) : null}
          {mapsEmbedUrl ? (
            <>
              <Div className="hospital-info-map-frame">
                <iframe
                  title={`${hospitalName} Google Maps`}
                  src={mapsEmbedUrl}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </Div>
              <Div className="hospital-info-map-actions">
                <A
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="moa-btn moa-btn-primary-outline moa-btn-xs hospital-info-map-link"
                >
                  <Icon name="map-marker" />
                  <Span>Google 지도에서 보기</Span>
                </A>
              </Div>
            </>
          ) : null}
        </Div>
      </Div>
    </Div>
  );
}
