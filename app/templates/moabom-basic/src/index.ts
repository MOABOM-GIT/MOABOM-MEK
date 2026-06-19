/**
 * Moabom Theme User Template
 *
 * 그누보드7 템플릿 엔진용 사용자 템플릿 컴포넌트 패키지
 * Moabom 스타일 기반
 */

// Logger 설정 (G7Core 초기화 전에도 동작하도록 폴백 포함)
const logger = ((window as any).G7Core?.createLogger?.('Template:moabom')) ?? {
    log: (...args: unknown[]) => console.log('[Template:moabom]', ...args),
    warn: (...args: unknown[]) => console.warn('[Template:moabom]', ...args),
    error: (...args: unknown[]) => console.error('[Template:moabom]', ...args),
};

// Styles
import './styles/main.css';
import './components/composite/imageGalleryLightboxStyles';
import { installMoabomTemplateLangFetchDedupe } from './i18n/moabomTemplateLangJsonFetch';
import { installMoabomGhostRoutesFetch } from './runtime/moabomGhostRoutesFetch';
import { installMoabomShellBootFetch, prefetchMoabomShellBoot } from './runtime/moabomShellBoot';
import { bootstrapMoabomShellAuthConfig } from './runtime/moabomShellAuth';
import { registerSirsoftEcommerceLayoutPrefetch } from './runtime/sirsoftEcommerceLayoutPrefetch';

// 지연 로드 셸 IIFE가 메인과 동일한 React Context를 쓰도록 싱글톤 모듈을 전역에 노출 (vite.shell-*.config.ts external)
import * as MoabomShellI18n from './i18n/moabomShellI18nSingleton';
import * as MoabomShellOverlay from './i18n/moabomShellOverlaySingleton';
import * as MoabomCreateAppEdit from './apps/ai-generator/moabomCreateAppEditSession';
if (typeof window !== 'undefined') {
  (window as unknown as { __MoabomShellI18n?: typeof MoabomShellI18n }).__MoabomShellI18n = MoabomShellI18n;
  (window as unknown as { __MoabomShellOverlay?: typeof MoabomShellOverlay }).__MoabomShellOverlay =
    MoabomShellOverlay;
  (window as unknown as { __MoabomCreateAppEdit?: typeof MoabomCreateAppEdit }).__MoabomCreateAppEdit =
    MoabomCreateAppEdit;
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
export * from './pages';

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
 * 코어 엔진에 커스텀 핸들러를 등록합니다.
 */
export function initTemplate(): void {
  // ActionDispatcher가 로드될 때까지 대기 후 핸들러 등록
  if (typeof window !== 'undefined') {
    let retryCount = 0;
    const maxRetries = 50; // 최대 5초 대기 (50 * 100ms)

    const registerHandlers = () => {
      const actionDispatcher = (window as any).G7Core?.getActionDispatcher?.();

      if (actionDispatcher) {
        // handlerMap의 모든 핸들러를 자동으로 등록
        Object.entries(handlerMap).forEach(([name, handler]) => {
          actionDispatcher.registerHandler(name, handler);
        });

        logger.log(`${Object.keys(handlerMap).length} custom handler(s) registered:`, Object.keys(handlerMap));
      } else {
        retryCount++;
        if (retryCount <= maxRetries) {
          logger.warn(`ActionDispatcher not found, retrying... (${retryCount}/${maxRetries})`);
          setTimeout(registerHandlers, 100);
        } else {
          logger.error('Failed to register handlers: ActionDispatcher not available after maximum retries');
        }
      }
    };

    const installManifestLink = () => {
      import('./runtime/pwa/installManifestLink')
        .then((module) => {
          module.installMoabomPwaManifestLink();
          module.installMoabomPwaIconLinks();
        })
        .catch((error) => {
          logger.warn('PWA manifest link module failed to load.', error);
        });
    };

    const registerServiceWorker = () => {
      if (!navigator.serviceWorker) return;

      import('./runtime/pwa/registerServiceWorker')
        .then((module) => module.registerMoabomPwaServiceWorker())
        .catch((error) => {
          logger.warn('PWA Service Worker registration module failed to load.', error);
        });
    };

    // window.load 이벤트 사용 (모든 리소스 로드 완료 후)
    if (document.readyState === 'complete') {
      registerHandlers();
      installManifestLink();
      registerServiceWorker();
    } else {
      window.addEventListener('load', registerHandlers);
      window.addEventListener('load', installManifestLink, { once: true });
      window.addEventListener('load', registerServiceWorker, { once: true });
    }
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
    installMoabomShellBootFetch();
    prefetchMoabomShellBoot();
    installMoabomGhostRoutesFetch();
}

initTemplate();

if (typeof window !== 'undefined') {
    registerSirsoftEcommerceLayoutPrefetch();
}
