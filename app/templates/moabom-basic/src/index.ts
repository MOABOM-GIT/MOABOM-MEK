/**
 * Moabom Theme User Template
 *
 * 그누보드7 템플릿 엔진용 사용자 템플릿 컴포넌트 패키지
 * Moabom 스타일 기반
 */

// Styles
import './styles/main.css';
import './components/composite/imageGalleryLightboxStyles';
import { installMoabomTemplateLangFetchDedupe } from './i18n/moabomTemplateLangJsonFetch';
import { installMoabomGhostRoutesFetch } from './runtime/moabomGhostRoutesFetch';
import { installMoabomExtensionDeferredBootstrap } from './runtime/moabomExtensionDeferredBootstrap';
import { ensureMoaShellErrorPageHandlerPatched } from './shell/installMoaShellErrorNavigateBridge';
import { installMoabomShellBootFetch, prefetchMoabomShellBoot } from './runtime/moabomShellBoot';
import { installMoabomShellCriticalFetch } from './runtime/moabomShellCriticalFetch';
import { startMoabomShellBootPipeline } from './runtime/moabomShellBootPipeline';
import { installMoabomPwaExtensionResyncConsume } from './runtime/pwa/moabomPwaExtensionResync';
import { bootstrapMoabomShellAuthConfig } from './runtime/moabomShellAuth';
import { installMoabomShellAuthSingleFlight } from './runtime/moabomShellAuthSingleFlight';
import { installMoabomUserShellStateFetch } from './runtime/moabomUserShellState';
import { installMoabomWebSocketAuthSync } from './runtime/moabomWebSocketAuthSync';
import { registerSirsoftEcommerceLayoutPrefetch } from './runtime/sirsoftEcommerceLayoutPrefetch';
import { schedulePrefetchRecentMoabomShellAppChunks } from './runtime/moabomShellAppChunkPrefetch';

// 지연 로드 셸 IIFE가 메인과 동일한 React Context를 쓰도록 싱글톤 모듈을 전역에 노출 (vite.shell-*.config.ts external)
import * as MoabomShellI18n from './i18n/moabomShellI18nSingleton';
import * as MoabomShellOverlay from './i18n/moabomShellOverlaySingleton';
import * as MoabomCreateAppEdit from './apps/ai-generator/moabomCreateAppEditSession';
import * as MoabomCreateAppPrompt from './apps/ai-generator/moabomCreateAppPromptSession';
import * as MoabomAiGenerationActivity from './apps/ai-generator/aiGenerationActivity';
if (typeof window !== 'undefined') {
  (window as unknown as { __MoabomShellI18n?: typeof MoabomShellI18n }).__MoabomShellI18n = MoabomShellI18n;
  (window as unknown as { __MoabomShellOverlay?: typeof MoabomShellOverlay }).__MoabomShellOverlay =
    MoabomShellOverlay;
  (window as unknown as { __MoabomCreateAppEdit?: typeof MoabomCreateAppEdit }).__MoabomCreateAppEdit =
    MoabomCreateAppEdit;
  (window as unknown as { __MoabomCreateAppPrompt?: typeof MoabomCreateAppPrompt }).__MoabomCreateAppPrompt =
    MoabomCreateAppPrompt;
  (window as unknown as { __MoabomAiGenerationActivity?: typeof MoabomAiGenerationActivity }).__MoabomAiGenerationActivity =
    MoabomAiGenerationActivity;
}

// Basic Components (Header, Footer는 composite에서 사용하므로 여기서는 별도 이름으로 export)
export {
  Button,
  type ButtonProps,
  FileInput,
  type FileInputProps,
  Input,
  type InputProps,
  PasswordInput,
  type PasswordInputProps,
  type PasswordRule,
  defaultPasswordRules,
  availablePasswordRules,
  Textarea,
  type TextareaProps,
  Label,
  type LabelProps,
  Div,
  type DivProps,
  Span,
  type SpanProps,
  P,
  type PProps,
  Img,
  type ImgProps,
  H1,
  type H1Props,
  H2,
  type H2Props,
  H3,
  type H3Props,
  H4,
  type H4Props,
  Ul,
  type UlProps,
  Ol,
  type OlProps,
  Li,
  type LiProps,
  A,
  type AProps,
  Form,
  type FormProps,
  Select,
  type SelectProps,
  Option,
  type OptionProps,
  Optgroup,
  type OptgroupProps,
  Checkbox,
  type CheckboxProps,
  Table,
  type TableProps,
  Thead,
  type TheadProps,
  Tbody,
  type TbodyProps,
  Tr,
  type TrProps,
  Th,
  type ThProps,
  Td,
  type TdProps,
  Nav,
  type NavProps,
  Section,
  type SectionProps,
  Svg,
  type SvgProps,
  Icon,
  type IconProps,
  Code,
  type CodeProps,
  Footer as BasicFooter,
  type FooterProps as BasicFooterProps,
  Header as BasicHeader,
  type HeaderProps as BasicHeaderProps,
  Hr,
  type HrProps,
  IconName,
  type IconStyle,
  type IconSize,
} from './components/basic';

// Composite Components
export * from './components/composite';

// Layout Components
export * from './components/layout';

// Pages (HomePage — 코어 `app.blade.php`는 `components.iife.js`만 로드하므로 전역 등록은 메인 번들에 포함해야 함)
export { HomePage, type HomePageProps } from './pages/HomePage';

// Template Metadata
import templateMetadata from '../template.json';

// Handlers
import { handlerMap } from './handlers';

// handlerMap을 전역으로 노출 (로케일 변경 시 재등록용)
if (typeof window !== 'undefined') {
  (window as any).G7TemplateHandlers = handlerMap;
}

/**
 * 템플릿 메타데이터 export
 *
 * template.json 파일의 내용을 번들에 포함시켜 API 호출 없이
 * 코어 엔진에서 직접 접근 가능하도록 합니다.
 */
export { templateMetadata };

/**
 * 템플릿 초기화 함수
 *
 * Auth single-flight 를 부트 파이프라인보다 먼저 설치해 TemplateApp preloadAuth 와 합류한다.
 * 핸들러·PWA 등록은 `startMoabomShellBootPipeline()` 이 DOMContentLoaded 이후 순차 처리한다.
 */
export function initTemplate(): void {
  if (typeof window !== 'undefined') {
    installMoabomShellAuthSingleFlight();
    startMoabomShellBootPipeline();
  }
}

// 템플릿 초기화 자동 실행
if (typeof window !== 'undefined') {
    import('./runtime/moabomToastEnqueue')
      .then((module) => module.installMoabomToastEnqueue())
      .catch(() => {
        // G7Core 부트 전이면 Toast 마운트 시 재시도한다.
      });
    installMoabomTemplateLangFetchDedupe();
    bootstrapMoabomShellAuthConfig();
    installMoabomShellAuthSingleFlight();
    installMoabomUserShellStateFetch();
    installMoabomWebSocketAuthSync();
    installMoabomShellBootFetch();
    installMoabomShellCriticalFetch();
    prefetchMoabomShellBoot();
    installMoabomExtensionDeferredBootstrap();
    installMoabomGhostRoutesFetch();
    ensureMoaShellErrorPageHandlerPatched();
    installMoabomPwaExtensionResyncConsume();
}

initTemplate();

if (typeof window !== 'undefined') {
    registerSirsoftEcommerceLayoutPrefetch();
    // board/profile layout 은 창 오픈·좌측 탭 진입 시 prefetch (전역 tertiary 선로드 제거)
    schedulePrefetchRecentMoabomShellAppChunks();
}
