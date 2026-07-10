import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { App } from '../../data/Moa_apps';
import { Div } from '../basic/Div';
import { Icon } from '../basic/Icon';
import { readWebsiteIconFromMetadata } from '../../apps/ai-generator/websiteLinkApp';
import { isLightShellGradient, shellChromeToneClasses } from '../../utils/shellGradientContrast';

export interface Moa_AppShellIconSurfaceProps {
  app: App;
  className?: string;
  symbolClassName?: string;
  style?: CSSProperties;
  isCreateApp?: boolean;
}

function resolveIconImageUrl(app: App): string | null {
  const direct = app.iconImageUrl?.trim();
  if (direct) {
    return direct;
  }

  const fromMetadata = readWebsiteIconFromMetadata(app.metadata);
  return fromMetadata || null;
}

/**
 * 그리드·좌측 패널 앱 아이콘 표면.
 * 파비콘 실패 상태는 URL 키에 귀속되며, FA 폴백 색은 타일 gradient 대비로 결정한다.
 */
export function Moa_AppShellIconSurface({
  app,
  className = '',
  symbolClassName = '',
  style,
  isCreateApp = false,
}: Moa_AppShellIconSurfaceProps) {
  const iconImageUrl = resolveIconImageUrl(app);
  const [failedIconUrl, setFailedIconUrl] = useState<string | null>(null);
  const showIconImage = Boolean(iconImageUrl) && failedIconUrl !== iconImageUrl;
  const lightTile = !isCreateApp && isLightShellGradient(app.gradient);
  const contrastIconClass = shellChromeToneClasses(lightTile).icon;
  const resolvedSymbolClassName = [
    symbolClassName.replace(/\btext-white\b/g, '').trim(),
    contrastIconClass,
  ].filter(Boolean).join(' ');

  useEffect(() => {
    if (!iconImageUrl) {
      setFailedIconUrl(null);
    }
  }, [iconImageUrl]);

  return (
    <Div
      className={`relative flex items-center justify-center overflow-hidden ${className}`.trim()}
      style={isCreateApp ? style : { background: app.gradient, ...style }}
    >
      {showIconImage ? (
        <img
          src={iconImageUrl ?? ''}
          alt=""
          className="moa-app-shell-icon-image"
          draggable={false}
          onError={() => {
            if (iconImageUrl) {
              setFailedIconUrl(iconImageUrl);
            }
          }}
        />
      ) : (
        <Icon name={app.icon} className={resolvedSymbolClassName} />
      )}
    </Div>
  );
}
