import React from 'react';
import { Div } from '../basic/Div';
import { Icon } from '../basic/Icon';
import { P } from '../basic/P';
import { Span } from '../basic/Span';
import { useMoabomShellT } from '../../i18n/MoabomUiI18nProvider';
import { resolvePublicProfileDisplayName } from '../../utils/resolvePublicProfileDisplayName';
import { Avatar, type AuthorInfo } from './Avatar';
import { Moa_UserProfileActions } from './Moa_UserProfileActions';

export interface UserProfileHeroProfile {
  uuid?: string;
  name?: string;
  nickname?: string | null;
  status?: string;
  avatar?: string | null;
  created_at?: string | null;
  social_provider?: string | null;
  bio?: string | null;
}

export interface MoaUserProfileHeroProps {
  profile?: UserProfileHeroProfile | null;
  className?: string;
}

const SOCIAL_PROVIDER_LABEL_KEYS: Record<string, string> = {
  google: 'moa_auth.social_google_short',
  naver: 'moa_auth.social_naver_short',
  kakao: 'moa_auth.social_kakao_short',
};

export const Moa_UserProfileHero: React.FC<MoaUserProfileHeroProps> = ({
  profile,
  className = '',
}) => {
  const { t } = useMoabomShellT();

  if (!profile) {
    return null;
  }

  const isWithdrawn = profile.status === 'withdrawn';
  const displayName = isWithdrawn
    ? t('userinfo.withdrawn_user')
    : (resolvePublicProfileDisplayName(profile) ?? '-');

  const providerKey = profile.social_provider
    ? SOCIAL_PROVIDER_LABEL_KEYS[profile.social_provider]
    : null;
  const socialLabel = providerKey
    ? t(providerKey)
    : (profile.social_provider?.toUpperCase() ?? null);

  return (
    <Div className={`moa-user-profile-hero${className ? ` ${className}` : ''}`}>
      <Div className="moa-user-profile-hero__avatar-wrap">
        <Avatar
          author={profile as AuthorInfo}
          size="2xl"
          className="moa-user-profile-hero__avatar"
        />
      </Div>
      <Div className="moa-user-profile-hero__meta">
        {isWithdrawn ? (
          <Span className="moa-user-profile-hero__name moa-user-profile-hero__name--withdrawn">
            {displayName}
          </Span>
        ) : (
          <>
            <Div className="moa-user-profile-hero__name-row">
              <Span className="moa-user-profile-hero__name">{displayName}</Span>
              <Moa_UserProfileActions userUuid={profile.uuid} />
            </Div>
            {profile.created_at ? (
              <Div className="moa-user-profile-hero__joined">
                <Icon name="calendar" size="sm" className="moa-user-profile-hero__joined-icon" />
                <Span className="moa-user-profile-hero__joined-label">{t('user.profile.joined_at')}</Span>
                <Span className="moa-user-profile-hero__joined-value">{profile.created_at}</Span>
              </Div>
            ) : null}
            {socialLabel ? (
              <Span className="moa-user-profile-hero__provider">{socialLabel}</Span>
            ) : null}
          </>
        )}
        {profile.bio && !isWithdrawn ? (
          <P className="moa-user-profile-hero__bio">{profile.bio}</P>
        ) : null}
      </Div>
    </Div>
  );
};
