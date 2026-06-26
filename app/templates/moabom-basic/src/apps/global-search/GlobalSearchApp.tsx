import { useCallback, useEffect, useRef, useState } from 'react';
import { useMoabomShellT } from 'moabom-shell-i18n';
import { Button } from '../../components/basic/Button';
import { Div } from '../../components/basic/Div';
import { Icon } from '../../components/basic/Icon';
import { Input } from '../../components/basic/Input';
import { Span } from '../../components/basic/Span';
import type { App } from '../../data/Moa_apps';
import { resolveAppStrings } from '../../i18n/resolveAppStrings';
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
  generatedApps: [],
  boardPosts: [],
};

export function GlobalSearchApp() {
  const { t, language } = useMoabomShellT();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GlobalSearchResults>(EMPTY_RESULTS);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const executeSearch = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    setSubmittedQuery(trimmed);

    if (!hasSearchQuery(trimmed)) {
      setResults(EMPTY_RESULTS);
      return;
    }

    setLoading(true);
    try {
      const next = await runGlobalSearch(trimmed);
      setResults(next);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = useCallback((event?: React.FormEvent) => {
    event?.preventDefault();
    void executeSearch(query);
  }, [executeSearch, query]);

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
  const totalCount = results.systemApps.length + results.generatedApps.length + results.boardPosts.length;

  const renderAppResult = (app: App, onOpen: (app: App) => void) => {
    const { name } = resolveAppStrings(app, language);

    return (
      <SearchResultRow key={app.id} onClick={() => onOpen(app)}>
        <Span className="moa-global-search-result__icon" aria-hidden>
          <Icon name={app.icon} size="sm" />
        </Span>
        <Span className="moa-global-search-result__label">
          <HighlightText text={name} query={submittedQuery} />
        </Span>
        <Icon name="chevron-right" size="sm" className="moa-global-search-result__arrow" />
      </SearchResultRow>
    );
  };

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
                  setResults(EMPTY_RESULTS);
                  inputRef.current?.focus();
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
            className="moa-global-search-submit"
            disabled={!hasSearchQuery(query) || loading}
          >
            {loading ? t('moa_apps_search.searching') : t('moa_apps_search.submit')}
          </Button>
        </form>

        {!hasSubmitted ? (
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
                : t('moa_apps_search.result_count', { count: String(totalCount), query: submittedQuery })}
            </p>

            <SearchSection
              title={t('moa_apps_search.section_system_apps')}
              emptyLabel={t('moa_apps_search.empty_system_apps')}
              hasItems={results.systemApps.length > 0}
            >
              {results.systemApps.map(app => renderAppResult(app, openSystemApp))}
            </SearchSection>

            <SearchSection
              title={t('moa_apps_search.section_generated_apps')}
              emptyLabel={t('moa_apps_search.empty_generated_apps')}
              hasItems={results.generatedApps.length > 0}
            >
              {results.generatedApps.map(app => renderAppResult(app, openGeneratedApp))}
            </SearchSection>

            <SearchSection
              title={t('moa_apps_search.section_boards')}
              emptyLabel={t('moa_apps_search.empty_boards')}
              hasItems={results.boardPosts.length > 0}
            >
              {results.boardPosts.map(post => (
                <SearchResultRow key={`${post.boardSlug}-${post.id}`} onClick={() => openBoardPost(post)}>
                  <Span className="moa-global-search-result__board">
                    {post.boardName}
                  </Span>
                  <Span className="moa-global-search-result__divider" aria-hidden>—</Span>
                  <Span className="moa-global-search-result__label">
                    <HighlightText
                      text={post.title}
                      query={submittedQuery}
                      highlightedHtml={post.titleHighlighted}
                    />
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
