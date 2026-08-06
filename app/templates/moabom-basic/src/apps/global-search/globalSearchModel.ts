import type { App } from '../../data/Moa_apps';
import { APPS } from '../../data/Moa_apps';
import { appendNewShellBootApps } from '../shellBootApps';
import {
  isGeneratedLibraryAppId,
  mapStoredGeneratedAppToLibraryApp,
} from '../generatedAppLibrary';
import { loadMoabomGeneratedAppLibrary } from '../../runtime/moabomGeneratedAppLibraryLoad';
import { dedupeAppsById, SYSTEM_TOOL_APP_METADATA } from '../../shell/moaShellAppLists';
import { requestShellJson } from '../../api/moabomShellHttp';
import { hasShellAccessToken } from '../../api/moabomShellAccess';

const SELF_APP_ID = 'global-search';
const MIN_QUERY_LENGTH = 2;

export interface BoardSearchResult {
  id: number;
  title: string;
  titleHighlighted?: string;
  boardSlug: string;
  boardName: string;
}

export interface GlobalSearchResults {
  systemApps: App[];
  myApps: App[];
  publicApps: App[];
  boardPosts: BoardSearchResult[];
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function matchesQuery(text: string | undefined, query: string): boolean {
  if (!text || !query) {
    return false;
  }

  return text.toLowerCase().includes(query);
}

function appMatchesQuery(app: App, query: string): boolean {
  return matchesQuery(app.name, query) || matchesQuery(app.description, query);
}

function buildSystemCatalog(): App[] {
  return appendNewShellBootApps([...SYSTEM_TOOL_APP_METADATA, ...APPS]);
}

async function buildGeneratedCatalog(): Promise<{ owned: App[]; shared: App[] }> {
  const isLoggedIn = hasShellAccessToken();
  const library = await loadMoabomGeneratedAppLibrary(isLoggedIn);
  const owned = library.owned.map(mapStoredGeneratedAppToLibraryApp);
  const shared = library.shared.map(mapStoredGeneratedAppToLibraryApp);

  return {
    owned: dedupeAppsById(owned),
    shared: dedupeAppsById(shared),
  };
}

interface SearchPostsApiItem {
  id: number;
  title: string;
  title_highlighted?: string;
  board?: {
    slug?: string;
    name?: string;
  };
}

interface SearchPostsApiResponse {
  posts?: {
    items?: SearchPostsApiItem[];
  };
}

async function fetchBoardPosts(query: string): Promise<BoardSearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    type: 'posts',
    per_page: '20',
  });

  try {
    const data = await requestShellJson<SearchPostsApiResponse>(
      `/api/search?${params.toString()}`,
      'optional',
    );

    return (data.posts?.items ?? [])
      .filter(item => item.board?.slug)
      .map(item => ({
        id: item.id,
        title: item.title,
        titleHighlighted: item.title_highlighted,
        boardSlug: item.board?.slug ?? '',
        boardName: item.board?.name ?? '',
      }));
  } catch {
    return [];
  }
}

export async function runGlobalSearch(query: string): Promise<GlobalSearchResults> {
  const normalized = normalizeQuery(query);
  if (normalized.length < MIN_QUERY_LENGTH) {
    return { systemApps: [], myApps: [], publicApps: [], boardPosts: [] };
  }

  const [generatedCatalog, boardPosts] = await Promise.all([
    buildGeneratedCatalog(),
    fetchBoardPosts(query.trim()),
  ]);

  const systemCatalog = buildSystemCatalog().filter(app => {
    if (app.id === SELF_APP_ID) {
      return false;
    }
    if (isGeneratedLibraryAppId(app.id)) {
      return false;
    }
    return appMatchesQuery(app, normalized);
  });

  const ownedIds = new Set(generatedCatalog.owned.map(app => app.id));
  const myApps = generatedCatalog.owned.filter(app => appMatchesQuery(app, normalized));
  const publicApps = generatedCatalog.shared
    .filter(app => !ownedIds.has(app.id))
    .filter(app => appMatchesQuery(app, normalized));

  return {
    systemApps: systemCatalog,
    myApps,
    publicApps,
    boardPosts,
  };
}

export function hasSearchQuery(query: string): boolean {
  return normalizeQuery(query).length >= MIN_QUERY_LENGTH;
}
