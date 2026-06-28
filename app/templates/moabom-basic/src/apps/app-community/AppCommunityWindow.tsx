import { useCallback, useMemo, useState } from 'react';
import { useMoabomShellT } from '../../i18n/MoabomUiI18nProvider';
import { Button } from '../../components/basic/Button';
import { Div } from '../../components/basic/Div';
import { H2 } from '../../components/basic/H2';
import { Icon } from '../../components/basic/Icon';
import { Input } from '../../components/basic/Input';
import { Label } from '../../components/basic/Label';
import { Span } from '../../components/basic/Span';
import { Textarea } from '../../components/basic/Textarea';
import AppLoadingSpinner from '../../components/composite/AppLoadingSpinner';
import { useShellAuthStateKey } from '../../shell/moaShellAuthStateKey';
import { APP_SHELL_BODY_CLASS, APP_SHELL_DESC_CLASS, APP_SHELL_PANEL_BODY_CLASS, APP_WINDOW_BODY_CLASS } from '../appShellTypography';
import { formatRatingSummaryText, formatStarGlyphs } from './appCommunityStars';
import { useAppCommunity } from './useAppCommunity';
import { useGeneratedAppCommunityAccess } from './useGeneratedAppCommunityAccess';
import { openMoabomUserProfile } from '../../shell/openMoabomUserProfile';
import type { AppCommunityCreator } from '../../api/moabomAppCommunityApi';

export interface AppCommunityWindowProps {
  serverId: number;
  appTitle?: string;
  /** 셸 렌더러에서 주입 시 창 단위 `useShellAuthStateKey` 구독 생략 가능 */
  authStateKey?: string;
  onAuthRequired?: () => void;
}

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (rating: number) => void;
}) {
  return (
    <Div className="app-community-stars" role="group" aria-label="rating">
      {[1, 2, 3, 4, 5].map(star => (
        <Button
          key={star}
          type="button"
          variant="primary-outline"
          size="medium"
          className={`app-community-star ${value >= star ? 'is-active' : ''}`}
          onClick={() => onChange(star)}
          aria-label={`${star}`}
        >
          <Icon name="star" />
        </Button>
      ))}
    </Div>
  );
}

function AppCommunityListButton({ onClick }: { onClick: () => void }) {
  const { t } = useMoabomShellT();

  return (
    <Button type="button" variant="dark-outline" size="medium" onClick={onClick}>
      <Span>{t('moa_apps_ai.community.back')}</Span>
    </Button>
  );
}

function AppCommunityCreatorChip({
  creator,
  onOpenProfile,
}: {
  creator: AppCommunityCreator;
  onOpenProfile: (uuid: string) => void;
}) {
  const { t } = useMoabomShellT();
  const uuid = creator.owner.uuid?.trim() ?? '';
  const nickname = creator.owner.nickname.trim() || t('moa_apps_ai.community.creator_unknown');
  const roleLabel = creator.role === 'original'
    ? t('moa_apps_ai.community.creator_original')
    : t('moa_apps_ai.community.creator_remix');

  return (
    <Button
      type="button"
      variant="primary-outline"
      size="sm"
      className={`app-community-creator-chip ${creator.is_current ? 'is-current' : ''}`}
      disabled={!uuid}
      title={roleLabel}
      onClick={() => {
        if (uuid) {
          onOpenProfile(uuid);
        }
      }}
    >
      <Span className="app-community-creator-role">{roleLabel}</Span>
      <Span className="app-community-creator-name">{nickname}</Span>
    </Button>
  );
}

function AppCommunityCreatorsRow({
  creators,
  onOpenProfile,
}: {
  creators: AppCommunityCreator[];
  onOpenProfile: (uuid: string) => void;
}) {
  const { t } = useMoabomShellT();

  if (creators.length === 0) {
    return null;
  }

  return (
    <Div className="app-community-creators" role="list" aria-label={t('moa_apps_ai.community.creators_label')}>
      {creators.map((creator, index) => (
        <Div key={`${creator.generated_app_id}-${creator.owner.id}`} className="app-community-creators-item" role="listitem">
          {index > 0 ? (
            <Icon name="chevron-right" size="xs" className="app-community-creators-sep" aria-hidden />
          ) : null}
          <AppCommunityCreatorChip creator={creator} onOpenProfile={onOpenProfile} />
        </Div>
      ))}
    </Div>
  );
}

export function AppCommunityWindow({
  serverId,
  appTitle = '',
  authStateKey: authStateKeyProp,
  onAuthRequired,
}: AppCommunityWindowProps) {
  const { t } = useMoabomShellT();
  const storeAuthStateKey = useShellAuthStateKey();
  const authStateKey = authStateKeyProp ?? storeAuthStateKey;
  const { canWrite } = useGeneratedAppCommunityAccess(serverId, authStateKey);
  const community = useAppCommunity({
    appId: serverId,
    canWrite,
    authStateKey,
    onAuthRequired,
  });
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [rating, setRating] = useState(5);

  const headerTitle = useMemo(() => {
    const trimmed = appTitle.trim();
    return trimmed || t('moa_apps_ai.community.window_title_fallback', { id: serverId });
  }, [appTitle, serverId, t]);

  const creators = community.summary?.creators ?? [];

  const handleOpenCreatorProfile = useCallback((uuid: string) => {
    openMoabomUserProfile(uuid, 'profile');
  }, []);

  const openComposeForm = () => {
    if (!canWrite) {
      onAuthRequired?.();
      return;
    }
    const mine = community.posts.find(post => post.is_mine);
    setTitle(mine?.title ?? '');
    setBody(mine?.body ?? '');
    setRating(mine?.rating ?? community.summary?.my_review?.rating ?? 5);
    community.openCompose();
  };

  if (community.isLoading && community.view === 'list') {
    return <AppLoadingSpinner label={t('moa_apps_ai.community.loading')} fill />;
  }

  return (
    <Div className={`app-community-window ${APP_WINDOW_BODY_CLASS} ${APP_SHELL_BODY_CLASS}`}>
      {creators.length > 0 ? (
        <Div className="app-community-creators-panel glass-panel moa-app-panel">
          <AppCommunityCreatorsRow creators={creators} onOpenProfile={handleOpenCreatorProfile} />
        </Div>
      ) : null}

      <Div className="app-community-header glass-panel moa-app-panel">
        <Div className="app-community-header-main">
          <H2 className="app-community-title">{headerTitle}</H2>
          <Span className="app-community-rating-summary">
            {formatRatingSummaryText(community.summary?.rating_avg, community.summary?.rating_count ?? 0)}
          </Span>
        </Div>
        {canWrite ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="app-community-compose-btn"
            onClick={openComposeForm}
          >
            <Icon name="pen" />
            <Span>{community.hasMyReview ? t('moa_apps_ai.community.edit_review') : t('moa_apps_ai.community.write_review')}</Span>
          </Button>
        ) : null}
      </Div>

      {community.error ? (
        <Div className={`app-community-error ${APP_SHELL_DESC_CLASS}`}>{community.error}</Div>
      ) : null}

      {community.view === 'list' ? (
        <Div className="app-community-list">
          {community.posts.length === 0 ? (
            <Div className={`app-community-empty ${APP_SHELL_PANEL_BODY_CLASS}`}>
              {t('moa_apps_ai.community.empty')}
            </Div>
          ) : (
            <>
              {community.totalPostCount > community.posts.length ? (
                <Div className={`app-community-list-summary ${APP_SHELL_DESC_CLASS}`}>
                  {t('moa_apps_ai.community.list_progress', {
                    shown: community.posts.length,
                    total: community.totalPostCount,
                  })}
                </Div>
              ) : null}
              {community.posts.map(post => (
                <Button
                  key={post.id}
                  type="button"
                  variant="primary-outline"
                  className="app-community-card moa-group"
                  onClick={() => community.openDetail(post)}
                >
                  <Div className="app-community-card-top">
                    <Span className="app-community-card-rating">{formatStarGlyphs(post.rating)}</Span>
                    <Span className="app-community-card-date">
                      {post.created_at ? String(post.created_at).slice(0, 10) : ''}
                    </Span>
                  </Div>
                  <Div className="app-community-card-title">{post.title}</Div>
                  <Div className={`app-community-card-body ${APP_SHELL_DESC_CLASS}`}>{post.body}</Div>
                  <Div className="app-community-card-author">{post.author.nickname}</Div>
                </Button>
              ))}
              {community.hasMore ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="medium"
                  className="app-community-load-more"
                  disabled={community.isLoadingMore || community.isLoading}
                  onClick={() => void community.loadMore()}
                >
                  {community.isLoadingMore
                    ? t('moa_apps_ai.community.loading_more')
                    : t('moa_apps_ai.community.load_more')}
                </Button>
              ) : null}
            </>
          )}
        </Div>
      ) : null}

      {community.view === 'detail' && community.selectedPost ? (
        <Div className={`app-community-detail ${APP_SHELL_PANEL_BODY_CLASS}`}>
          <Div className="app-community-detail-rating">{formatStarGlyphs(community.selectedPost.rating)}</Div>
          <H2 className="app-community-detail-title">{community.selectedPost.title}</H2>
          <Div className="app-community-detail-meta">
            {community.selectedPost.author.nickname}
            {' · '}
            {community.selectedPost.created_at ? String(community.selectedPost.created_at).slice(0, 10) : ''}
          </Div>
          <Div className="app-community-detail-body">{community.selectedPost.body}</Div>
          <Div className="app-community-footer-actions">
            <AppCommunityListButton onClick={community.backToList} />
          </Div>
        </Div>
      ) : null}

      {community.view === 'compose' ? (
        <Div className={`app-community-compose ${APP_SHELL_PANEL_BODY_CLASS}`}>
          <Div className="app-community-compose-field">
            <Label>{t('moa_apps_ai.community.field_rating')}</Label>
            <StarPicker value={rating} onChange={setRating} />
          </Div>
          <Div className="app-community-compose-field">
            <Label>{t('moa_apps_ai.community.field_title')}</Label>
            <Input
              type="text"
              value={title}
              maxLength={120}
              onChange={event => setTitle(event.target.value)}
            />
          </Div>
          <Div className="app-community-compose-field">
            <Label>{t('moa_apps_ai.community.field_body')}</Label>
            <Textarea
              value={body}
              rows={6}
              onChange={event => setBody(event.target.value)}
            />
          </Div>
          <Div className="app-community-footer-actions app-community-compose-actions">
            <AppCommunityListButton onClick={community.backToList} />
            <Button
              type="button"
              variant="primary"
              size="medium"
              disabled={community.isSaving || !title.trim() || !body.trim()}
              onClick={() => void community.submitReview({ title: title.trim(), body: body.trim(), rating })}
            >
              {community.isSaving ? t('moa_apps_ai.community.saving') : t('moa_apps_ai.community.save')}
            </Button>
            {community.hasMyReview ? (
              <Button
                type="button"
                variant="danger-outline"
                size="medium"
                disabled={community.isSaving}
                onClick={() => void community.removeMyReview()}
              >
                {t('moa_apps_ai.community.delete_review')}
              </Button>
            ) : null}
          </Div>
        </Div>
      ) : null}
    </Div>
  );
}
