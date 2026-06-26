import { createShellAppMetadata } from '../_shared/createShellAppMetadata';

export const globalSearchAppMetadata = createShellAppMetadata({
  id: 'global-search',
  icon: 'magnifying-glass',
  gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
  strings: {
    ko: { name: '전체검색', description: '게시판 및 앱검색' },
    en: { name: 'Global Search', description: 'Search boards and apps' },
    ja: { name: '全体検索', description: '掲示板とアプリ検索' },
    zh: { name: '全局搜索', description: '搜索公告板与应用' },
  },
});
