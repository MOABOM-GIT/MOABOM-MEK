/**
 * WSL에는 admin node_modules 가 없을 수 있다 (Cloud Build 가 npm ci).
 * IDE/tsc 가 의존성 타입만 못 찾을 때를 위한 ambient 선언.
 */
declare module '@monaco-editor/react' {
  const Editor: any;
  export default Editor;
  export type Monaco = any;
  export type EditorProps = Record<string, any>;
  export type OnMount = (...args: any[]) => void;
  export type BeforeMount = (...args: any[]) => void;
}

declare module 'monaco-editor' {
  const monaco: any;
  export default monaco;
  export const languages: any;
  export const editor: any;
  export namespace editor {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export type IStandaloneCodeEditor = any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export type IMarkerData = any;
  }
}

declare module 'browser-image-compression' {
  const imageCompression: (file: File, options?: Record<string, unknown>) => Promise<File>;
  export default imageCompression;
}

declare module 'yet-another-react-lightbox' {
  const Lightbox: any;
  export default Lightbox;
  export type Slide = Record<string, unknown>;
}

declare module 'yet-another-react-lightbox/plugins/zoom' {
  const Zoom: any;
  export default Zoom;
}

declare module 'yet-another-react-lightbox/plugins/counter' {
  const Counter: any;
  export default Counter;
}

declare module 'yet-another-react-lightbox/plugins/slideshow' {
  const Slideshow: any;
  export default Slideshow;
}

declare module 'yet-another-react-lightbox/plugins/fullscreen' {
  const Fullscreen: any;
  export default Fullscreen;
}

declare module 'yet-another-react-lightbox/plugins/thumbnails' {
  const Thumbnails: any;
  export default Thumbnails;
}

declare module 'yet-another-react-lightbox/styles.css';
declare module 'yet-another-react-lightbox/plugins/counter.css';
declare module 'yet-another-react-lightbox/plugins/thumbnails.css';

declare module 'react-select' {
  const Select: any;
  export default Select;
  export const components: any;
  export type MultiValue<T = any> = T[];
  export type SingleValue<T = any> = T | null;
  export type ActionMeta<T = any> = { action: string; removedValue?: T; [key: string]: any };
  export type InputActionMeta = { action: string; [key: string]: any };
  export type StylesConfig<Option = any, IsMulti extends boolean = boolean, Group = any> = Record<string, any>;
  export type GroupBase<Option = any> = { options: Option[]; label?: string };
  export type Props<Option = any, IsMulti extends boolean = boolean, Group = any> = Record<string, any>;
}

declare module 'react-select/creatable' {
  const CreatableSelect: any;
  export default CreatableSelect;
}

declare module 'vitest-axe' {
  export function axe(container: Element): Promise<{ violations: unknown[] }>;
  export function toHaveNoViolations(): unknown;
}
