import { useEffect, useRef, useState, type ChangeEvent, type RefObject } from 'react';
import type { MoabomTranslateFn } from '../../../../i18n/moabomT';
import {
  cropAvatarToSquare,
  fetchUserProfileApi,
  updateUserProfileApi,
  uploadUserAvatarApi,
} from '../myPageApi';
import type { AuthManagerUserSnapshot, MyPageTab, MyPageUser } from '../myPageTypes';
import { flattenFieldErrors, showCoreToast } from '../myPageUtils';

interface UseMyPageProfileTabOptions {
  activeTab: MyPageTab;
  currentUser: MyPageUser | null;
  t: MoabomTranslateFn;
  avatarInputRef: RefObject<HTMLInputElement | null>;
  accountInfoUnlocked?: boolean;
  onProfileUpdated?: (user?: AuthManagerUserSnapshot | null) => void;
}

export function useMyPageProfileTab({
  activeTab,
  currentUser,
  t,
  avatarInputRef,
  accountInfoUnlocked = false,
  onProfileUpdated,
}: UseMyPageProfileTabOptions) {
  const [nickname, setNickname] = useState(currentUser?.name ?? '');
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileMobile, setProfileMobile] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar ?? '');
  const [bio, setBio] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaveSubmitting, setProfileSaveSubmitting] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileBanner, setProfileBanner] = useState<{ text: string } | null>(null);
  const [profileFieldErrors, setProfileFieldErrors] = useState<Record<string, string>>({});
  const [profileSocialProvider, setProfileSocialProvider] = useState<string | null>(null);
  const loadedMemberKeyRef = useRef<string | null>(null);
  const currentUserNameRef = useRef(currentUser?.name ?? '');
  currentUserNameRef.current = currentUser?.name ?? '';

  const memberKey = currentUser?.memberKey ?? (currentUser ? 'authenticated' : '');

  useEffect(() => {
    const canLoadForActiveTab = activeTab === 'profile'
      || (activeTab === 'account' && accountInfoUnlocked);
    if (!canLoadForActiveTab || !memberKey) return;
    if (loadedMemberKeyRef.current === memberKey) return;

    let cancelled = false;
    setProfileLoading(true);
    setProfileBanner(null);
    setProfileFieldErrors({});

    void (async () => {
      try {
        const result = await fetchUserProfileApi();
        if (cancelled) return;
        if (!result.ok) {
          setProfileBanner({
            text: result.kind === 'unauthorized'
              ? t('moa_mypage.msg.profile_load_failed')
              : t('moa_mypage.msg.profile_transient_error'),
          });
          return;
        }
        const data = result.data;
        setProfileName(String(data.name ?? ''));
        setNickname(String(data.nickname ?? data.name ?? currentUserNameRef.current));
        setProfileEmail(String(data.email ?? ''));
        setProfileMobile(String(data.mobile ?? ''));
        setAvatarUrl(String(data.avatar ?? ''));
        setBio(String(data.bio ?? ''));
        setProfileSocialProvider(data.social_provider ?? null);
        loadedMemberKeyRef.current = memberKey;
      } catch {
        if (!cancelled) {
          setProfileBanner({ text: t('moa_mypage.msg.profile_transient_error') });
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accountInfoUnlocked, activeTab, memberKey]);

  const profileErr = (field: string) => profileFieldErrors[field] ?? '';

  const handleSaveProfile = async (_includeAccountInfo = false) => {
    setProfileFieldErrors({});
    setProfileSaveSubmitting(true);

    try {
      const accountPayload = {
        name: profileName.trim() || currentUser?.name || nickname.trim(),
        email: profileEmail.trim(),
        mobile: profileMobile.trim() || null,
      };
      const profilePayload: Record<string, unknown> = {
        ...accountPayload,
        nickname: nickname.trim() || null,
        bio: bio.trim() || null,
      };

      if (!accountPayload.email) {
        setProfileFieldErrors({ email: t('moa_mypage.msg.email_missing_field') });
        showCoreToast('error', t('moa_mypage.msg.email_missing_toast'), 4500);
        return;
      }

      const result = await updateUserProfileApi(profilePayload);

      if (!result.ok) {
        setProfileFieldErrors(flattenFieldErrors(result.errors));
        const errMsg = result.message ?? t('moa_mypage.msg.save_failed');
        showCoreToast('error', errMsg, 4500);
        return;
      }

      showCoreToast('success', result.message ?? t('moa_mypage.msg.profile_saved'), 3000);

      const G7Core = (window as any).G7Core;
      const authManager = G7Core?.AuthManager?.getInstance?.();
      if (authManager?.checkAuth) {
        await authManager.checkAuth('user');
      }
      const refreshed = authManager?.getUser?.();
      onProfileUpdated?.(refreshed ?? (result.data as AuthManagerUserSnapshot | undefined) ?? null);
    } finally {
      setProfileSaveSubmitting(false);
    }
  };

  const handleAvatarFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setProfileFieldErrors({});
    setProfileBanner(null);
    setAvatarUploading(true);

    try {
      const croppedFile = await cropAvatarToSquare(file);
      const result = await uploadUserAvatarApi(croppedFile);
      if (!result.ok) {
        setProfileFieldErrors(flattenFieldErrors(result.errors));
        showCoreToast('error', result.message ?? t('moa_mypage.msg.avatar_failed'), 4500);
        return;
      }

      const nextAvatar = result.data?.avatar ?? '';
      setAvatarUrl(nextAvatar);
      showCoreToast('success', result.message ?? t('moa_mypage.msg.avatar_success'), 3000);
      onProfileUpdated?.({
        name: profileName || currentUser?.name,
        nickname,
        email: profileEmail,
        avatar: nextAvatar,
        level: currentUser?.level,
        point: currentUser?.point,
        is_admin: currentUser?.is_admin,
        is_super: currentUser?.is_super,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('moa_mypage.msg.avatar_failed_generic');
      showCoreToast('error', message, 4500);
    } finally {
      setAvatarUploading(false);
    }
  };

  const userInitial = (nickname || currentUser?.name || t('moa_mypage.common.user_fallback')).charAt(0).toUpperCase();
  const profileBusy = profileSaveSubmitting || avatarUploading;

  return {
    nickname,
    setNickname,
    profileName,
    setProfileName,
    profileEmail,
    setProfileEmail,
    profileMobile,
    setProfileMobile,
    avatarUrl,
    bio,
    setBio,
    avatarInputRef,
    profileBusy,
    profileLoading,
    profileBanner,
    profileErr,
    userInitial,
    profileSaveSubmitting,
    avatarUploading,
    profileSocialProvider,
    handleSaveProfile,
    handleAvatarFile,
  };
}
