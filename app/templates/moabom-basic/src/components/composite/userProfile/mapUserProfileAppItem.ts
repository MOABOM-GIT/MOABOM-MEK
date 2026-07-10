import type { StoredGeneratedAppSummary } from '../../../api/moabomAppsApi';
import { APPS, type App } from '../../../data/Moa_apps';
import {
  isGeneratedLibraryAppId,
  mapStoredGeneratedAppToLibraryApp,
  parseGeneratedLibraryServerId,
  resolveGeneratedAppTitleBarGradient,
} from '../../../apps/generatedAppLibrary';
import { resolveGeneratedAppIconFromTitle } from '../../../apps/generated/generatedAppIconFromTitle';

type UserProfileAppItem = Record<string, unknown>;

function isStoredGeneratedSummary(item: UserProfileAppItem): item is StoredGeneratedAppSummary {
  return typeof item.id === 'number' && typeof item.title === 'string';
}

function mapFrequentGeneratedItem(item: UserProfileAppItem, shellId: string): App | null {
  const serverId = typeof item.generated_app_id === 'number'
    ? item.generated_app_id
    : parseGeneratedLibraryServerId(shellId);
  if (serverId === null) {
    return null;
  }

  const title = String(item.title ?? shellId).trim() || shellId;
  const appType = typeof item.app_type === 'string' ? item.app_type : 'general';
  const metadata = item.metadata && typeof item.metadata === 'object'
    ? (item.metadata as Record<string, unknown>)
    : {};
  const iconUrl = typeof item.icon_url === 'string' && item.icon_url.trim()
    ? item.icon_url.trim()
    : (typeof metadata.icon_url === 'string' ? metadata.icon_url.trim() : '');

  return {
    id: shellId,
    name: title,
    description: '',
    icon: resolveGeneratedAppIconFromTitle(title, undefined, appType),
    iconImageUrl: iconUrl || undefined,
    gradient: resolveGeneratedAppTitleBarGradient(serverId, appType, metadata),
    category: 'user',
    source: 'user-created',
    metadata: {
      generatedServerId: serverId,
      appType,
      ...(iconUrl ? { iconImageUrl: iconUrl } : {}),
      ...metadata,
    },
  };
}

/** 공개 프로필 활동 API 항목 → 마이페이지 라이브러리와 동일한 App 카드 */
export function mapUserProfileAppItemToLibraryApp(item: UserProfileAppItem): App | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  if (isStoredGeneratedSummary(item)) {
    return mapStoredGeneratedAppToLibraryApp(item);
  }

  const shellId = String(item.shell_id ?? item.id ?? '').trim();
  if (!shellId) {
    return null;
  }

  if (item.kind === 'generated' || isGeneratedLibraryAppId(shellId)) {
    return mapFrequentGeneratedItem(item, shellId);
  }

  const catalog = APPS.find(app => app.id === shellId);
  if (catalog) {
    return catalog;
  }

  const title = String(item.title ?? shellId).trim() || shellId;

  return {
    id: shellId,
    name: title,
    description: '',
    icon: String(item.icon ?? 'cube'),
    gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    category: 'basic',
    source: 'system',
  };
}
