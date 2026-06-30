import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { App } from '../../data/Moa_apps';
import { Div } from '../basic/Div';
import { Icon } from '../basic/Icon';
import { readWebsiteIconFromMetadata } from '../../apps/ai-generator/websiteLinkApp';

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

export function Moa_AppShellIconSurface({
  app,
  className = '',
  symbolClassName = '',
  style,
  isCreateApp = false,
}: Moa_AppShellIconSurfaceProps) {
  const iconImageUrl = resolveIconImageUrl(app);
  const [iconImageFailed, setIconImageFailed] = useState(false);
  const showIconImage = Boolean(iconImageUrl) && !iconImageFailed;

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
          onError={() => setIconImageFailed(true)}
        />
      ) : (
        <Icon name={app.icon} className={symbolClassName} />
      )}
    </Div>
  );
}
