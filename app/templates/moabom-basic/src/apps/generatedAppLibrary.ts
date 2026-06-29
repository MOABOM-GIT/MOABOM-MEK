import type { App } from '../data/Moa_apps';
import type { StoredGeneratedAppSummary } from '../api/moabomAppsApi';
import { isGeneratedAppPublished } from '../api/moabomAppsApi';
import { pickGeneratedAppDisplayTitle } from './generated/resolveGeneratedAppDisplayTitle';
import { resolveGeneratedAppIconFromTitle } from './generated/generatedAppIconFromTitle';
import {
  isWebsiteLinkAppType,
  isWebsiteTitleIconFromMetadata,
  readWebsiteIconFromMetadata,
  readWebsiteUrlFromMetadata,
  resolveWebsiteLinkAppGradient,
} from './ai-generator/websiteLinkApp';

const GENERATED_APP_GRADIENT_PALETTES = [
  ['#6366f1', '#8b5cf6'],
  ['#34d399', '#0d9488'],
  ['#38bdf8', '#1d4ed8'],
  ['#a78bfa', '#6366f1'],
  ['#22d3ee', '#3b82f6'],
  ['#fb923c', '#f43f5e'],
  ['#14b8a6', '#0ea5e9'],
  ['#c084fc', '#f472b6'],
  ['#06b6d4', '#2563eb'],
  ['#27bfc1', '#479ee2'],
] as const;

export function generatedAppLibraryId(serverId: number): string {
  return `generated-app-${serverId}`;
}

export function isGeneratedLibraryAppId(appId: string): boolean {
  return appId.startsWith('generated-app-');
}

/** 셸 id `generated-app-{n}` → 서버 id (유효하지 않으면 null) */
export function parseGeneratedLibraryServerId(appId: string): number | null {
  if (!isGeneratedLibraryAppId(appId)) {
    return null;
  }
  const raw = appId.slice('generated-app-'.length);
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0 || String(id) !== raw) {
    return null;
  }
  return id;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function generatedAppGradient(seed: string): string {
  const palette = GENERATED_APP_GRADIENT_PALETTES[hashString(seed) % GENERATED_APP_GRADIENT_PALETTES.length];

  return `linear-gradient(135deg,${palette[0]},${palette[1]})`;
}

/** 생성앱 타이틀바·아이콘 그라데이션 SSOT — serverId만으로 해시(새로고침·딥링크와 라이브러리 동일) */
export function resolveGeneratedAppTitleBarGradient(serverId: number, appType = 'general', metadata?: Record<string, unknown>): string {
  if (isWebsiteLinkAppType(appType)) {
    const iconImageUrl = readWebsiteIconFromMetadata(metadata ?? {});

    return resolveWebsiteLinkAppGradient(metadata ?? {}, Boolean(iconImageUrl));
  }

  return generatedAppGradient(String(serverId));
}

/** API 생성 앱 목록 항목 → 마이페이지 library `App` 카드 */
export function mapStoredGeneratedAppToLibraryApp(item: StoredGeneratedAppSummary): App {
  const appType = item.app_type ?? 'general';
  const title = pickGeneratedAppDisplayTitle(
    item.title?.trim(),
    item.prompt?.trim()?.slice(0, 80),
  );
  const promptHint = item.prompt?.trim();
  const metadata = item.metadata ?? {};
  const isWebsiteLink = isWebsiteLinkAppType(appType);
  const iconImageUrl = readWebsiteIconFromMetadata(metadata);
  const iconFromTitle = isWebsiteLink && isWebsiteTitleIconFromMetadata(metadata);
  const description = isWebsiteLink
    ? (promptHint ?? '')
    : (promptHint && promptHint.length > 0 ? promptHint.slice(0, 120) : appType);

  return {
    id: generatedAppLibraryId(item.id),
    name: title,
    description,
    icon: resolveGeneratedAppIconFromTitle(title, promptHint, appType),
    iconImageUrl: iconImageUrl || undefined,
    gradient: isWebsiteLink
      ? resolveWebsiteLinkAppGradient(metadata, Boolean(iconImageUrl))
      : resolveGeneratedAppTitleBarGradient(item.id, appType, metadata),
    category: 'user',
    source: 'user-created',
    defaultLocale: 'ko',
    metadata: {
      generatedServerId: item.id,
      tier: item.tier ?? 'standard',
      isShared: isGeneratedAppPublished(item),
      visibility: item.visibility ?? (item.is_shared ? 'tenant' : 'private'),
      owner: item.owner,
      permissions: item.permissions,
      community: item.community,
      appType,
      websiteUrl: readWebsiteUrlFromMetadata(metadata) || undefined,
      iconImageUrl: iconImageUrl || undefined,
      ...(iconFromTitle ? { iconFromTitle: true } : {}),
    },
  };
}

/**
 * URL·딥링크 창 메타데이터용 최소 App.
 * 메인 그리드·라이브러리 표시에는 사용하지 않음 — 서버 검증 라이브러리만 표시 SSOT.
 */
export function buildSyntheticGeneratedLibraryApp(appId: string): App | null {
  const serverId = parseGeneratedLibraryServerId(appId);
  if (serverId == null) {
    return null;
  }
  return mapStoredGeneratedAppToLibraryApp({
    id: serverId,
    title: '',
    app_type: 'general',
  });
}
