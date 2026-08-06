import { useCallback, useEffect, useRef, useState } from 'react';
import { useMoabomShellT } from 'moabom-shell-i18n';
import { Button } from '../../components/basic/Button';
import { Div } from '../../components/basic/Div';
import { Icon } from '../../components/basic/Icon';
import { Input } from '../../components/basic/Input';
import { Span } from '../../components/basic/Span';
import { LibrarySection } from '../../components/composite/mypage/Moa_MyPageLibraryBlocks';
import type { App } from '../../data/Moa_apps';
import { useShellWindowAuthStateKey } from '../../shell/ShellWindowAuthContext';
import { formatBoardShellPath, formatShellPath, pushShellPath } from '../../utils/moabomShellRoutes';
import { AppWindowHeader } from '../_shared/AppWindowHeader';
import { APP_SHELL_PANEL_BODY_CLASS, APP_WINDOW_BODY_CLASS } from '../appShellTypography';
import { HighlightText, SearchResultRow, SearchSection } from './GlobalSearchUi';
import { globalSearchAppMetadata } from './metadata';
import {
  hasSearchQuery,
  runGlobalSearch,
  type BoardSearchResult,
  type GlobalSearchResults,
} from './globalSearchModel';

const EMPTY_RESULTS: GlobalSearchResults = {
  systemApps: [],
  myApps: [],
  publicApps: [],
  boardPosts: [],
};

export function GlobalSearchApp() {
  const { t, language } = useMoabomShellT();
  const authStateKey = useShellWindowAuthStateKey();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GlobalSearchResults>(EMPTY_RESULTS);
  const lastFetchKeyRef = useRef('');

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback((event?: React.FormEvent) => {
    event?.preventDefault();
    setSubmittedQuery(query.trim());
  }, [query]);

  useEffect(() => {
    if (!hasSearchQuery(submittedQuery)) {
      lastFetchKeyRef.current = '';
      setResults(EMPTY_RESULTS);
      setLoading(false);
      return;
    }

    const fetchKey = `${authStateKey}\0${submittedQuery}`;
    if (lastFetchKeyRef.current === fetchKey) {
      return;
    }
    lastFetchKeyRef.current = fetchKey;

    let cancelled = false;
    setLoading(true);
    void runGlobalSearch(submittedQuery)
      .then(next => {
        if (!cancelled) {
          setResults(next);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authStateKey, submittedQuery]);

  const openSystemApp = useCallback((app: App) => {
    pushShellPath(formatShellPath({ kind: 'app', appId: app.id }));
  }, []);

  const openGeneratedApp = useCallback((app: App) => {
    pushShellPath(formatShellPath({ kind: 'app', appId: app.id }));
  }, []);

  const openBoardPost = useCallback((post: BoardSearchResult) => {
    pushShellPath(formatBoardShellPath(post.boardSlug, String(post.id)));
  }, []);

  const hasSubmitted = submittedQuery.length > 0;
  const showResults = hasSubmitted && hasSearchQuery(submittedQuery);
  const totalCount = results.systemApps.length
    + results.myApps.length
    + results.publicApps.length
    + results.boardPosts.length;
  const appInfoFallback = t('moa_mypage.library.app_info_fallback');

  return (
    <Div className={`${APP_WINDOW_BODY_CLASS} moa-global-search-app`}>
      <AppWindowHeader
        title={t('moa_apps.global-search.name')}
        subtitle={t('moa_apps.global-search.description')}
        icon={globalSearchAppMetadata.icon}
        gradient={globalSearchAppMetadata.gradient}
      />

      <Div className={`moa-global-search-body${showResults ? ' is-results' : ''}`}>
        <form
          className={`moa-global-search-form${showResults ? ' is-compact' : ' is-hero'}`}
          onSubmit={handleSubmit}
          role="search"
        >
          <Div className="moa-global-search-input-wrap moa-app-panel glass-sm-blur">
            <Icon name="magnifying-glass" className="moa-global-search-input__icon" />
            <Input
              ref={inputRef}
              type="text"
              inputMode="search"
              enterKeyHint="search"
              className="moa-global-search-input bg-transparent"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={t('moa_apps_search.placeholder')}
              aria-label={t('moa_apps_search.placeholder')}
              autoComplete="off"
            />
            {query ? (
              <button
                type="button"
                className="moa-global-search-clear"
                onClick={() => {
                  setQuery('');
                  setSubmittedQuery('');
                  lastFetchKeyRef.current = '';
                  setResults(EMPTY_RESULTS);
                }}
                aria-label={t('moa_apps_search.clear')}
              >
                <Icon name="xmark" size="sm" />
              </button>
            ) : null}
          </Div>
          <Button
            type="submit"
            variant="primary"
            size="medium"
            className="moa-global-search-submit"
            disabled={loading}
          >
            {t('moa_apps_search.submit')}
          </Button>
        </form>

        {!showResults && !hasSubmitted ? (
          <Div className={`${APP_SHELL_PANEL_BODY_CLASS} moa-global-search-hint`}>
            <Icon name="magnifying-glass" className="text-3xl text-faint" />
            <p className="moa-global-search-hint__text">{t('moa_apps_search.hint')}</p>
          </Div>
        ) : null}

        {hasSubmitted && !hasSearchQuery(submittedQuery) ? (
          <Div className={`${APP_SHELL_PANEL_BODY_CLASS} moa-global-search-hint`}>
            <p className="moa-global-search-hint__text">{t('moa_apps_search.min_length')}</p>
          </Div>
        ) : null}

        {showResults ? (
          <Div className="moa-global-search-results">
            <p className="moa-global-search-summary">
              {loading
                ? t('moa_apps_search.searching')
                : t('moa_apps_search.result_count', { count: totalCount, query: submittedQuery })}
            </p>
            {results.systemApps.length > 0 ? (
              <LibrarySection
                title={t('moa_apps_search.section_system_apps')}
                emptyText={t('moa_apps_search.empty_system_apps')}
                apps={results.systemApps}
                locale={language}
                appInfoFallback={appInfoFallback}
                onOpenApp={openSystemApp}
              />
            ) : null}
            {results.myApps.length > 0 ? (
              <LibrarySection
                title={t('moa_apps_search.section_generated_apps')}
                emptyText={t('moa_apps_search.empty_generated_apps')}
                apps={results.myApps}
                locale={language}
                appInfoFallback={appInfoFallback}
                onOpenApp={openGeneratedApp}
              />
            ) : null}
            {results.publicApps.length > 0 ? (
              <LibrarySection
                title={t('moa_apps_search.section_public_apps')}
                emptyText={t('moa_apps_search.empty_public_apps')}
                apps={results.publicApps}
                locale={language}
                appInfoFallback={appInfoFallback}
                onOpenApp={openGeneratedApp}
              />
            ) : null}
            <SearchSection
              title={t('moa_apps_search.section_boards')}
              emptyLabel={t('moa_apps_search.empty_boards')}
              hasItems={results.boardPosts.length > 0}
            >
              {results.boardPosts.map(post => (
                <SearchResultRow key={`${post.boardSlug}-${post.id}`} onClick={() => openBoardPost(post)}>
                  <Span className="moa-global-search-result__icon" aria-hidden>
                    <Icon name="comments" size="sm" />
                  </Span>
                  <Span className="moa-global-search-result__board">
                    <HighlightText text={post.boardName} query={submittedQuery} />
                  </Span>
                  <Span className="moa-global-search-result__divider" aria-hidden>—</Span>
                  <Span className="moa-global-search-result__label">
                    {post.titleHighlighted ? (
                      <Span className="moa-global-search-highlight" dangerouslySetInnerHTML={{ __html: post.titleHighlighted }} />
                    ) : (
                      <HighlightText text={post.title} query={submittedQuery} />
                    )}
                  </Span>
                  <Icon name="chevron-right" size="sm" className="moa-global-search-result__arrow" />
                </SearchResultRow>
              ))}
            </SearchSection>
          </Div>
        ) : null}
      </Div>
    </Div>
  );
}
