import {
  createOptionalShellModuleApi,
  createShellModuleApi,
  MoabomShellAuthRequiredError,
} from './moabomShellHttp';

export interface AppCommunityAuthor {
  id: number;
  nickname: string;
}

export interface AppCommunityPost {
  id: number;
  generated_app_id: number;
  post_type: 'review';
  rating: number | null;
  title: string;
  body: string;
  author: AppCommunityAuthor;
  is_mine: boolean;
  created_at?: string | null;
}

export interface AppCommunityCreator {
  generated_app_id: number;
  role: 'original' | 'remix';
  is_current: boolean;
  owner: {
    id: number;
    uuid: string | null;
    nickname: string;
  };
}

export interface AppCommunitySummary {
  rating_avg: number | null;
  rating_count: number;
  post_count: number;
  my_review: { id: number; rating: number } | null;
  creators?: AppCommunityCreator[];
}

export interface AppCommunityListResponse {
  items: AppCommunityPost[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
}

export const APP_COMMUNITY_POSTS_PAGE_SIZE = 20;

const requestOptional = createOptionalShellModuleApi('moabom-apps');
const requestAuth = createShellModuleApi('moabom-apps');

function communityPath(appId: number, suffix = ''): string {
  return `apps/generated/${appId}/community${suffix}`;
}

export async function fetchAppCommunitySummary(appId: number): Promise<AppCommunitySummary> {
  return requestOptional<AppCommunitySummary>(communityPath(appId, '/summary'));
}

export async function fetchAppCommunityPosts(
  appId: number,
  page = 1,
  perPage = APP_COMMUNITY_POSTS_PAGE_SIZE,
): Promise<AppCommunityListResponse> {
  const query = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });

  return requestOptional<AppCommunityListResponse>(`${communityPath(appId, '/posts')}?${query}`);
}

export async function fetchAppCommunityPost(appId: number, postId: number): Promise<AppCommunityPost> {
  return requestOptional<AppCommunityPost>(communityPath(appId, `/posts/${postId}`));
}

export interface StoreAppCommunityReviewPayload {
  title: string;
  body: string;
  rating: number;
}

export async function createAppCommunityReview(
  appId: number,
  payload: StoreAppCommunityReviewPayload,
): Promise<AppCommunityPost> {
  try {
    const result = await requestAuth<{ item: AppCommunityPost }>(communityPath(appId, '/posts'), {
      method: 'POST',
      body: payload,
    });

    return result.item;
  } catch (error) {
    if (error instanceof MoabomShellAuthRequiredError) {
      throw error;
    }
    throw error;
  }
}

export async function updateAppCommunityReview(
  appId: number,
  postId: number,
  payload: StoreAppCommunityReviewPayload,
): Promise<AppCommunityPost> {
  const result = await requestAuth<{ item: AppCommunityPost }>(
    communityPath(appId, `/posts/${postId}`),
    { method: 'PUT', body: payload },
  );

  return result.item;
}

export async function deleteAppCommunityReview(appId: number, postId: number): Promise<void> {
  await requestAuth(communityPath(appId, `/posts/${postId}`), { method: 'DELETE' });
}
