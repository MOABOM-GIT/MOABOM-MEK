/**
 * moabom 템플릿 Composite 배럴
 *
 * `components.json`에 등록된 이름만 여기서 정적 re-export한다.
 * ComponentRegistry는 IIFE 전역(`MoabomBasic` 등)의 **동일 이름 속성**으로 조회한다.
 *
 * 홈 셸 전용(Moa_Window, 마이페이지 본문 등)은 `components.json`에 없으므로 배럴에 두지 않는다.
 * 해당 모듈은 `Moa_HomePage` 등이 파일 경로로 직접 import하며, 배럴에 넣으면 번들 초기화 시점에
 * 불필요하게 함께 평가될 수 있다(특히 `React.lazy`만 쓰는 창 본문과 중복).
 */

// 레이아웃 컴포넌트
export { default as Header } from './Header';
export { default as Footer } from './Footer';
export { default as MobileNav } from './MobileNav';

// 상품 관련 컴포넌트
export { default as ProductCard } from './ProductCard';
export { default as ImageGallery } from './ImageGallery';
export { default as ProductImageViewer } from './ProductImageViewer';
export { default as QuantitySelector } from './QuantitySelector';

// 게시판 관련 컴포넌트
export { default as PostReactions } from './PostReactions';
export { default as RichTextEditor } from './RichTextEditor';
export { HtmlContent } from './HtmlContent';
export { HtmlEditor } from './HtmlEditor';

// 콘텐츠 유틸리티
export { ExpandableContent } from './ExpandableContent';

// 앱 스토어 컴포넌트
export { AppCard } from './Moa_AppCard';
export { AppGrid } from './Moa_AppGrid';

// 공통 컴포넌트
export { default as FileUploader } from './FileUploader';
export { ConfirmDialog } from './ConfirmDialog';
export { default as SocialLoginButtons } from './SocialLoginButtons';
export { default as Toast } from './Toast';
export { default as PageTransitionIndicator } from './PageTransitionIndicator';
export { default as PageTransitionBlur } from './PageTransitionBlur';
export { default as PageSkeleton } from './PageSkeleton';
export { default as PageLoading } from './PageLoading';
export { default as AppLoadingSpinner } from './AppLoadingSpinner';
export { default as PanelEmptyState } from './Moa_PanelEmptyState';
export { default as ThemeToggle } from './ThemeToggle';
export { Pagination } from './Pagination';
export { SearchBar } from './SearchBar';
export { Avatar } from './Avatar';
export { AvatarUploader } from './AvatarUploader';
export { UserInfo } from './UserInfo';
export { Moa_UserProfileActions, Moa_UserProfileActions as UserProfileActions } from './Moa_UserProfileActions';
export { Moa_UserProfileHero, Moa_UserProfileHero as UserProfileHero } from './Moa_UserProfileHero';
export { Moa_UserProfileAppGrid, Moa_UserProfileAppGrid as UserProfileAppGrid } from './Moa_UserProfileAppGrid';
export { Modal } from './Modal';
export { TabNavigation } from './TabNavigation';
// AddressSearch는 별도 컴포넌트가 아닌 sirsoft-daum_postcode 플러그인의 extension_point 방식 사용
