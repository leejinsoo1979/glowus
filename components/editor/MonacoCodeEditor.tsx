"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'
import { Loader2, AlertCircle, AlertTriangle, Info, ChevronDown, ChevronUp, X } from 'lucide-react'
import type { Monaco } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'

// Monaco Editor는 클라이언트에서만 로드
const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-zinc-900">
      <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
    </div>
  ),
})

// 마커 타입 정의
interface DiagnosticMarker {
  severity: number
  message: string
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
  source?: string
  code?: string | number
}

// Monaco 언어 설정 초기화 (한 번만 실행)
let monacoInitialized = false

function initializeMonacoLanguages(monaco: Monaco) {
  if (monacoInitialized) return
  monacoInitialized = true

  // TypeScript/JavaScript 컴파일러 옵션 설정 - 실제 프로젝트 수준
  const tsCompilerOptions = {
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    allowNonTsExtensions: true,
    allowJs: true,
    checkJs: true,
    strict: true,
    noImplicitAny: true,
    strictNullChecks: true,
    strictFunctionTypes: true,
    strictBindCallApply: true,
    strictPropertyInitialization: false, // 클래스 속성 초기화 체크 비활성화 (단일 파일에서는 너무 엄격)
    noImplicitReturns: true,
    noFallthroughCasesInSwitch: true,
    noUnusedLocals: true,
    noUnusedParameters: false, // 단일 파일에서는 파라미터 체크 비활성화
    noImplicitThis: true,
    alwaysStrict: true,
    jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
    jsxImportSource: 'react',
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    resolveJsonModule: true,
    isolatedModules: true,
    noEmit: true,
    lib: ['ES2020', 'DOM', 'DOM.Iterable'],
  }

  monaco.languages.typescript.typescriptDefaults.setCompilerOptions(tsCompilerOptions)
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    ...tsCompilerOptions,
    allowJs: true,
    checkJs: true,
    noImplicitAny: false,
    strict: false,
  })

  // TypeScript 진단 옵션 활성화
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: false,
  })

  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: false,
  })

  // 포괄적인 타입 정의 추가
  const comprehensiveTypes = `
// React 18+ 타입 정의
declare module 'react' {
  export type ReactNode = string | number | boolean | null | undefined | ReactElement | Iterable<ReactNode>;
  export interface ReactElement<P = any, T extends string | JSXElementConstructor<any> = string | JSXElementConstructor<any>> {
    type: T;
    props: P;
    key: string | null;
  }
  export type JSXElementConstructor<P> = ((props: P) => ReactElement<any, any> | null) | (new (props: P) => Component<any, any>);
  export type ComponentType<P = {}> = ComponentClass<P> | FunctionComponent<P>;
  export type FC<P = {}> = FunctionComponent<P>;
  export interface FunctionComponent<P = {}> {
    (props: P): ReactElement<any, any> | null;
    displayName?: string;
  }
  export class Component<P = {}, S = {}> {
    constructor(props: P);
    props: Readonly<P>;
    state: Readonly<S>;
    setState(state: Partial<S> | ((prevState: S, props: P) => Partial<S>)): void;
    forceUpdate(): void;
    render(): ReactNode;
  }
  export interface ComponentClass<P = {}> {
    new (props: P): Component<P, any>;
  }

  // Hooks
  export function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];
  export function useEffect(effect: EffectCallback, deps?: DependencyList): void;
  export function useLayoutEffect(effect: EffectCallback, deps?: DependencyList): void;
  export function useCallback<T extends Function>(callback: T, deps: DependencyList): T;
  export function useMemo<T>(factory: () => T, deps: DependencyList): T;
  export function useRef<T>(initialValue: T): MutableRefObject<T>;
  export function useRef<T>(initialValue: T | null): RefObject<T>;
  export function useRef<T = undefined>(): MutableRefObject<T | undefined>;
  export function useContext<T>(context: Context<T>): T;
  export function useReducer<R extends Reducer<any, any>>(reducer: R, initialState: ReducerState<R>): [ReducerState<R>, Dispatch<ReducerAction<R>>];
  export function useId(): string;
  export function useTransition(): [boolean, TransitionStartFunction];
  export function useDeferredValue<T>(value: T): T;
  export function useImperativeHandle<T, R extends T>(ref: Ref<T> | undefined, init: () => R, deps?: DependencyList): void;
  export function useDebugValue<T>(value: T, format?: (value: T) => any): void;

  // Types
  export type SetStateAction<S> = S | ((prevState: S) => S);
  export type Dispatch<A> = (value: A) => void;
  export type EffectCallback = () => void | (() => void);
  export type DependencyList = readonly unknown[];
  export type Reducer<S, A> = (prevState: S, action: A) => S;
  export type ReducerState<R extends Reducer<any, any>> = R extends Reducer<infer S, any> ? S : never;
  export type ReducerAction<R extends Reducer<any, any>> = R extends Reducer<any, infer A> ? A : never;
  export type TransitionStartFunction = (callback: () => void) => void;
  export interface MutableRefObject<T> { current: T; }
  export interface RefObject<T> { readonly current: T | null; }
  export type Ref<T> = RefCallback<T> | RefObject<T> | null;
  export type RefCallback<T> = (instance: T | null) => void;
  export interface Context<T> { Provider: Provider<T>; Consumer: Consumer<T>; displayName?: string; }
  export interface Provider<T> { (props: { value: T; children?: ReactNode }): ReactElement | null; }
  export interface Consumer<T> { (props: { children: (value: T) => ReactNode }): ReactElement | null; }

  // Event Handlers
  export type MouseEvent<T = Element> = SyntheticEvent<T> & { clientX: number; clientY: number; button: number; };
  export type KeyboardEvent<T = Element> = SyntheticEvent<T> & { key: string; code: string; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; };
  export type ChangeEvent<T = Element> = SyntheticEvent<T> & { target: EventTarget & T; };
  export type FormEvent<T = Element> = SyntheticEvent<T>;
  export type FocusEvent<T = Element> = SyntheticEvent<T>;
  export type DragEvent<T = Element> = SyntheticEvent<T> & { dataTransfer: DataTransfer; };
  export interface SyntheticEvent<T = Element> {
    currentTarget: EventTarget & T;
    target: EventTarget;
    preventDefault(): void;
    stopPropagation(): void;
    nativeEvent: Event;
  }

  export type MouseEventHandler<T = Element> = (event: MouseEvent<T>) => void;
  export type KeyboardEventHandler<T = Element> = (event: KeyboardEvent<T>) => void;
  export type ChangeEventHandler<T = Element> = (event: ChangeEvent<T>) => void;
  export type FormEventHandler<T = Element> = (event: FormEvent<T>) => void;
  export type FocusEventHandler<T = Element> = (event: FocusEvent<T>) => void;
  export type DragEventHandler<T = Element> = (event: DragEvent<T>) => void;

  // HTML Attributes
  export interface HTMLAttributes<T> {
    className?: string;
    id?: string;
    style?: CSSProperties;
    children?: ReactNode;
    onClick?: MouseEventHandler<T>;
    onChange?: ChangeEventHandler<T>;
    onKeyDown?: KeyboardEventHandler<T>;
    onKeyUp?: KeyboardEventHandler<T>;
    onFocus?: FocusEventHandler<T>;
    onBlur?: FocusEventHandler<T>;
    onSubmit?: FormEventHandler<T>;
    onDragStart?: DragEventHandler<T>;
    onDragEnd?: DragEventHandler<T>;
    onDrop?: DragEventHandler<T>;
    onDragOver?: DragEventHandler<T>;
    tabIndex?: number;
    title?: string;
    role?: string;
    'aria-label'?: string;
    'aria-hidden'?: boolean;
    'data-testid'?: string;
    [key: string]: any;
  }

  export interface CSSProperties {
    [key: string]: string | number | undefined;
  }

  export function createContext<T>(defaultValue: T): Context<T>;
  export function forwardRef<T, P = {}>(render: (props: P, ref: Ref<T>) => ReactElement | null): FC<P & { ref?: Ref<T> }>;
  export function memo<P extends object>(component: FC<P>, propsAreEqual?: (prevProps: P, nextProps: P) => boolean): FC<P>;
  export function lazy<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>): T;
  export function createElement(type: any, props?: any, ...children: any[]): ReactElement;
  export function cloneElement(element: ReactElement, props?: any, ...children: any[]): ReactElement;
  export function isValidElement(object: any): object is ReactElement;
  export const Fragment: FC<{ children?: ReactNode }>;
  export const Suspense: FC<{ fallback: ReactNode; children?: ReactNode }>;
  export const StrictMode: FC<{ children?: ReactNode }>;
}

// JSX 네임스페이스
declare global {
  namespace JSX {
    interface Element extends React.ReactElement<any, any> {}
    interface ElementClass extends React.Component<any> {}
    interface IntrinsicElements {
      div: React.HTMLAttributes<HTMLDivElement>;
      span: React.HTMLAttributes<HTMLSpanElement>;
      p: React.HTMLAttributes<HTMLParagraphElement>;
      a: React.HTMLAttributes<HTMLAnchorElement> & { href?: string; target?: string; rel?: string; };
      button: React.HTMLAttributes<HTMLButtonElement> & { type?: 'button' | 'submit' | 'reset'; disabled?: boolean; };
      input: React.HTMLAttributes<HTMLInputElement> & { type?: string; value?: string | number; placeholder?: string; disabled?: boolean; checked?: boolean; name?: string; };
      textarea: React.HTMLAttributes<HTMLTextAreaElement> & { value?: string; placeholder?: string; rows?: number; cols?: number; };
      select: React.HTMLAttributes<HTMLSelectElement> & { value?: string | number; };
      option: React.HTMLAttributes<HTMLOptionElement> & { value?: string | number; };
      form: React.HTMLAttributes<HTMLFormElement> & { action?: string; method?: string; };
      label: React.HTMLAttributes<HTMLLabelElement> & { htmlFor?: string; };
      img: React.HTMLAttributes<HTMLImageElement> & { src?: string; alt?: string; width?: number; height?: number; };
      ul: React.HTMLAttributes<HTMLUListElement>;
      ol: React.HTMLAttributes<HTMLOListElement>;
      li: React.HTMLAttributes<HTMLLIElement>;
      h1: React.HTMLAttributes<HTMLHeadingElement>;
      h2: React.HTMLAttributes<HTMLHeadingElement>;
      h3: React.HTMLAttributes<HTMLHeadingElement>;
      h4: React.HTMLAttributes<HTMLHeadingElement>;
      h5: React.HTMLAttributes<HTMLHeadingElement>;
      h6: React.HTMLAttributes<HTMLHeadingElement>;
      header: React.HTMLAttributes<HTMLElement>;
      footer: React.HTMLAttributes<HTMLElement>;
      main: React.HTMLAttributes<HTMLElement>;
      nav: React.HTMLAttributes<HTMLElement>;
      section: React.HTMLAttributes<HTMLElement>;
      article: React.HTMLAttributes<HTMLElement>;
      aside: React.HTMLAttributes<HTMLElement>;
      table: React.HTMLAttributes<HTMLTableElement>;
      thead: React.HTMLAttributes<HTMLTableSectionElement>;
      tbody: React.HTMLAttributes<HTMLTableSectionElement>;
      tr: React.HTMLAttributes<HTMLTableRowElement>;
      th: React.HTMLAttributes<HTMLTableCellElement>;
      td: React.HTMLAttributes<HTMLTableCellElement>;
      svg: React.HTMLAttributes<SVGSVGElement> & { viewBox?: string; fill?: string; stroke?: string; xmlns?: string; };
      path: React.HTMLAttributes<SVGPathElement> & { d?: string; fill?: string; stroke?: string; strokeWidth?: number | string; };
      circle: React.HTMLAttributes<SVGCircleElement> & { cx?: number | string; cy?: number | string; r?: number | string; };
      rect: React.HTMLAttributes<SVGRectElement> & { x?: number | string; y?: number | string; width?: number | string; height?: number | string; rx?: number | string; };
      line: React.HTMLAttributes<SVGLineElement> & { x1?: number | string; y1?: number | string; x2?: number | string; y2?: number | string; };
      [elemName: string]: any;
    }
  }
}

// Node.js 글로벌
declare const require: (module: string) => any;
declare const module: { exports: any };
declare const exports: any;
declare const process: { env: Record<string, string | undefined>; cwd(): string; };
declare const __dirname: string;
declare const __filename: string;
declare const Buffer: any;
declare const global: typeof globalThis;

// 콘솔
declare const console: {
  log(...args: any[]): void;
  error(...args: any[]): void;
  warn(...args: any[]): void;
  info(...args: any[]): void;
  debug(...args: any[]): void;
  trace(...args: any[]): void;
  table(data: any): void;
  time(label?: string): void;
  timeEnd(label?: string): void;
  group(label?: string): void;
  groupEnd(): void;
  clear(): void;
  assert(condition?: boolean, ...args: any[]): void;
  count(label?: string): void;
  dir(obj: any): void;
};

// Next.js 타입
declare module 'next/link' {
  import { FC, ReactNode } from 'react';
  interface LinkProps { href: string; as?: string; replace?: boolean; scroll?: boolean; shallow?: boolean; passHref?: boolean; prefetch?: boolean; locale?: string | false; children?: ReactNode; className?: string; }
  const Link: FC<LinkProps>;
  export default Link;
}

declare module 'next/image' {
  import { FC } from 'react';
  interface ImageProps { src: string; alt: string; width?: number; height?: number; fill?: boolean; quality?: number; priority?: boolean; placeholder?: 'blur' | 'empty'; className?: string; style?: React.CSSProperties; }
  const Image: FC<ImageProps>;
  export default Image;
}

declare module 'next/router' {
  export interface NextRouter {
    pathname: string;
    query: Record<string, string | string[]>;
    asPath: string;
    push(url: string, as?: string, options?: any): Promise<boolean>;
    replace(url: string, as?: string, options?: any): Promise<boolean>;
    back(): void;
    reload(): void;
    events: { on(event: string, handler: (...args: any[]) => void): void; off(event: string, handler: (...args: any[]) => void): void; };
  }
  export function useRouter(): NextRouter;
}

declare module 'next/navigation' {
  export function useRouter(): { push(url: string): void; replace(url: string): void; back(): void; forward(): void; refresh(): void; prefetch(url: string): void; };
  export function usePathname(): string;
  export function useSearchParams(): URLSearchParams;
  export function useParams(): Record<string, string | string[]>;
}

// 일반 유틸리티 타입
type Awaited<T> = T extends Promise<infer U> ? U : T;
type Partial<T> = { [P in keyof T]?: T[P] };
type Required<T> = { [P in keyof T]-?: T[P] };
type Readonly<T> = { readonly [P in keyof T]: T[P] };
type Record<K extends keyof any, T> = { [P in K]: T };
type Pick<T, K extends keyof T> = { [P in K]: T[P] };
type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;
type Exclude<T, U> = T extends U ? never : T;
type Extract<T, U> = T extends U ? T : never;
type NonNullable<T> = T extends null | undefined ? never : T;
type Parameters<T extends (...args: any) => any> = T extends (...args: infer P) => any ? P : never;
type ReturnType<T extends (...args: any) => any> = T extends (...args: any) => infer R ? R : any;
`

  monaco.languages.typescript.typescriptDefaults.addExtraLib(comprehensiveTypes, 'global.d.ts')
  monaco.languages.typescript.javascriptDefaults.addExtraLib(comprehensiveTypes, 'global.d.ts')

  // JSON 스키마 검증 활성화
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: true,
    trailingCommas: 'warning',
    schemaValidation: 'warning',
    schemas: [
      {
        uri: 'http://json-schema.org/package',
        fileMatch: ['package.json'],
        schema: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', description: 'Package name' },
            version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+', description: 'Semantic version' },
            description: { type: 'string' },
            main: { type: 'string' },
            scripts: { type: 'object', additionalProperties: { type: 'string' } },
            dependencies: { type: 'object', additionalProperties: { type: 'string' } },
            devDependencies: { type: 'object', additionalProperties: { type: 'string' } },
            peerDependencies: { type: 'object', additionalProperties: { type: 'string' } },
            private: { type: 'boolean' },
            license: { type: 'string' },
            author: { oneOf: [{ type: 'string' }, { type: 'object' }] },
            repository: { oneOf: [{ type: 'string' }, { type: 'object' }] },
          },
        },
      },
      {
        uri: 'http://json-schema.org/tsconfig',
        fileMatch: ['tsconfig.json', 'tsconfig.*.json', 'jsconfig.json'],
        schema: {
          type: 'object',
          properties: {
            compilerOptions: {
              type: 'object',
              properties: {
                target: { type: 'string', enum: ['ES3', 'ES5', 'ES6', 'ES2015', 'ES2016', 'ES2017', 'ES2018', 'ES2019', 'ES2020', 'ES2021', 'ES2022', 'ESNext'] },
                module: { type: 'string' },
                lib: { type: 'array', items: { type: 'string' } },
                strict: { type: 'boolean' },
                esModuleInterop: { type: 'boolean' },
                skipLibCheck: { type: 'boolean' },
                outDir: { type: 'string' },
                rootDir: { type: 'string' },
                baseUrl: { type: 'string' },
                paths: { type: 'object' },
                jsx: { type: 'string', enum: ['preserve', 'react', 'react-jsx', 'react-jsxdev', 'react-native'] },
              },
            },
            include: { type: 'array', items: { type: 'string' } },
            exclude: { type: 'array', items: { type: 'string' } },
            extends: { type: 'string' },
          },
        },
      },
    ],
  })

  // CSS/SCSS/LESS 검증 활성화
  monaco.languages.css.cssDefaults.setOptions({
    validate: true,
    lint: {
      compatibleVendorPrefixes: 'warning',
      vendorPrefix: 'warning',
      duplicateProperties: 'warning',
      emptyRules: 'warning',
      importStatement: 'warning',
      boxModel: 'ignore',
      universalSelector: 'ignore',
      zeroUnits: 'warning',
      fontFaceProperties: 'warning',
      hexColorLength: 'warning',
      argumentsInColorFunction: 'error',
      unknownProperties: 'warning',
      ieHack: 'ignore',
      unknownVendorSpecificProperties: 'ignore',
      propertyIgnoredDueToDisplay: 'warning',
      important: 'ignore',
      float: 'ignore',
      idSelector: 'ignore',
    },
  })

  // HTML 검증
  monaco.languages.html.htmlDefaults.setOptions({
    format: {
      tabSize: 2,
      insertSpaces: true,
      wrapLineLength: 120,
      unformatted: '',
      contentUnformatted: 'pre,code,textarea',
      indentInnerHtml: false,
      preserveNewLines: true,
      maxPreserveNewLines: 2,
      indentHandlebars: false,
      endWithNewline: false,
      extraLiners: 'head, body, /html',
      wrapAttributes: 'auto',
    },
    suggest: { html5: true },
  })

  console.log('[Monaco] Language services initialized with comprehensive type definitions')
}

interface MonacoCodeEditorProps {
  value: string
  onChange: (value: string) => void
  language?: string
  height?: string | number
  readOnly?: boolean
  minimap?: boolean
  lineNumbers?: boolean
  className?: string
  fileName?: string
  showProblemsPanel?: boolean
}

export function MonacoCodeEditor({
  value,
  onChange,
  language = 'javascript',
  height = '300px',
  readOnly = false,
  minimap = false,
  lineNumbers = true,
  className = '',
  fileName = 'file.ts',
  showProblemsPanel = true,
}: MonacoCodeEditorProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [markers, setMarkers] = useState<DiagnosticMarker[]>([])
  const [problemsPanelOpen, setProblemsPanelOpen] = useState(false)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Monaco 마운트 시 초기화
  const handleEditorDidMount = useCallback((editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    // 언어 서비스 초기화
    initializeMonacoLanguages(monaco)

    // 에러 마커 업데이트 리스너
    const updateMarkers = () => {
      const model = editor.getModel()
      if (model) {
        const rawMarkers = monaco.editor.getModelMarkers({ resource: model.uri })
        const diagnostics: DiagnosticMarker[] = rawMarkers.map((m: editor.IMarker) => ({
          severity: m.severity,
          message: m.message,
          startLineNumber: m.startLineNumber,
          startColumn: m.startColumn,
          endLineNumber: m.endLineNumber,
          endColumn: m.endColumn,
          source: m.source || undefined,
          code: m.code?.toString(),
        }))
        setMarkers(diagnostics)

        // 에러가 있으면 자동으로 Problems 패널 열기
        const hasErrors = diagnostics.some(m => m.severity === monaco.MarkerSeverity.Error)
        if (hasErrors && !problemsPanelOpen) {
          setProblemsPanelOpen(true)
        }
      }
    }

    // 마커 변경 감지
    const disposable = monaco.editor.onDidChangeMarkers(() => {
      updateMarkers()
    })

    // 초기 마커 체크 (약간 딜레이 - 언어 서비스 초기화 대기)
    setTimeout(updateMarkers, 800)

    return () => {
      disposable.dispose()
    }
  }, [problemsPanelOpen])

  // 에러 클릭시 해당 라인으로 이동
  const goToMarker = useCallback((marker: DiagnosticMarker) => {
    if (editorRef.current) {
      editorRef.current.setPosition({
        lineNumber: marker.startLineNumber,
        column: marker.startColumn,
      })
      editorRef.current.revealLineInCenter(marker.startLineNumber)
      editorRef.current.focus()
    }
  }, [])

  if (!mounted) {
    return (
      <div
        className={`bg-zinc-900 rounded-lg flex items-center justify-center ${className}`}
        style={{ height }}
      >
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  const isDark = resolvedTheme === 'dark'

  // 에러/경고 분류
  const errors = markers.filter(m => m.severity === 8) // MarkerSeverity.Error = 8
  const warnings = markers.filter(m => m.severity === 4) // MarkerSeverity.Warning = 4
  const infos = markers.filter(m => m.severity === 2) // MarkerSeverity.Info = 2

  const getSeverityIcon = (severity: number) => {
    switch (severity) {
      case 8: return <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
      case 4: return <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
      default: return <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
    }
  }

  const getSeverityClass = (severity: number) => {
    switch (severity) {
      case 8: return 'border-l-red-500'
      case 4: return 'border-l-yellow-500'
      default: return 'border-l-blue-500'
    }
  }

  // Problems 패널 높이 계산
  const problemsPanelHeight = problemsPanelOpen ? Math.min(markers.length * 28 + 36, 180) : 0
  const editorHeight = typeof height === 'number'
    ? height - problemsPanelHeight - 28 // 상태바 높이
    : `calc(${height} - ${problemsPanelHeight + 28}px)`

  return (
    <div className={`overflow-hidden rounded-lg border flex flex-col ${isDark ? 'border-zinc-700 bg-[#1e1e1e]' : 'border-zinc-300 bg-white'} ${className}`}>
      {/* 에디터 영역 */}
      <div className="flex-1 min-h-0">
        <Editor
          height={editorHeight}
          language={language}
          value={value}
          onChange={(val) => onChange(val || '')}
          onMount={handleEditorDidMount}
          theme={isDark ? 'vs-dark' : 'light'}
          path={fileName}
          options={{
            readOnly,
            minimap: { enabled: minimap },
            lineNumbers: lineNumbers ? 'on' : 'off',
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            tabSize: 2,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
            padding: { top: 8, bottom: 8 },
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
            overviewRulerBorder: false,
            renderLineHighlight: 'all',
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            bracketPairColorization: { enabled: true },
            // 에러 표시 관련 옵션
            glyphMargin: true,
            folding: true,
            renderValidationDecorations: 'on',
            quickSuggestions: { other: true, comments: false, strings: true },
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            snippetSuggestions: 'inline',
            hover: { enabled: true, delay: 200 },
            parameterHints: { enabled: true },
            suggestSelection: 'first',
            tabCompletion: 'on',
            wordBasedSuggestions: 'currentDocument',
            // 추가 기능
            formatOnPaste: true,
            formatOnType: true,
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            autoSurround: 'languageDefined',
            linkedEditing: true,
          }}
        />
      </div>

      {/* Problems 패널 헤더 (상태바 역할) */}
      {showProblemsPanel && (
        <div
          className={`flex items-center justify-between px-3 py-1 text-xs border-t cursor-pointer select-none ${
            isDark ? 'bg-[#252526] border-zinc-700 hover:bg-zinc-700/50' : 'bg-zinc-100 border-zinc-200 hover:bg-zinc-200/50'
          }`}
          onClick={() => markers.length > 0 && setProblemsPanelOpen(!problemsPanelOpen)}
        >
          <div className="flex items-center gap-3">
            <span className={`font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>Problems</span>
            {errors.length > 0 && (
              <span className="flex items-center gap-1 text-red-500">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.length}
              </span>
            )}
            {warnings.length > 0 && (
              <span className="flex items-center gap-1 text-yellow-500">
                <AlertTriangle className="w-3.5 h-3.5" />
                {warnings.length}
              </span>
            )}
            {infos.length > 0 && (
              <span className="flex items-center gap-1 text-blue-500">
                <Info className="w-3.5 h-3.5" />
                {infos.length}
              </span>
            )}
            {markers.length === 0 && (
              <span className={isDark ? 'text-zinc-500' : 'text-zinc-400'}>No problems</span>
            )}
          </div>
          {markers.length > 0 && (
            <button className={`p-0.5 rounded ${isDark ? 'hover:bg-zinc-600' : 'hover:bg-zinc-300'}`}>
              {problemsPanelOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          )}
        </div>
      )}

      {/* Problems 목록 패널 */}
      {showProblemsPanel && problemsPanelOpen && markers.length > 0 && (
        <div
          className={`border-t overflow-y-auto ${isDark ? 'bg-[#1e1e1e] border-zinc-700' : 'bg-white border-zinc-200'}`}
          style={{ maxHeight: 150 }}
        >
          {markers.map((marker, index) => (
            <div
              key={`${marker.startLineNumber}-${marker.startColumn}-${index}`}
              onClick={() => goToMarker(marker)}
              className={`flex items-start gap-2 px-3 py-1.5 cursor-pointer border-l-2 ${getSeverityClass(marker.severity)} ${
                isDark ? 'hover:bg-zinc-800/80' : 'hover:bg-zinc-100'
              }`}
            >
              {getSeverityIcon(marker.severity)}
              <div className="flex-1 min-w-0">
                <span className={`text-xs ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  {marker.message}
                </span>
                {marker.code && (
                  <span className={`ml-2 text-[10px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    ts({marker.code})
                  </span>
                )}
              </div>
              <span className={`text-[10px] flex-shrink-0 font-mono ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                [{marker.startLineNumber}:{marker.startColumn}]
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// 언어 선택을 위한 옵션
export const LANGUAGE_OPTIONS = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'json', label: 'JSON' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'sql', label: 'SQL' },
  { value: 'yaml', label: 'YAML' },
  { value: 'shell', label: 'Shell' },
]
