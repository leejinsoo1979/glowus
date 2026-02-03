/**
 * Code Node Executor
 * JavaScript 코드를 안전하게 실행 (Node.js vm 모듈 사용)
 */

import * as vm from 'vm'
import type { NodeExecutionContext, NodeExecutionResult } from './index'

export interface CodeNodeConfig {
  // 코드
  code: string
  language?: 'javascript' | 'typescript'

  // 타임아웃 (ms)
  timeout?: number

  // 입력 변수 이름
  inputVariableName?: string
}

// console.log 캡처를 위한 래퍼
function createConsoleCapture(): { logs: string[]; console: typeof console } {
  const logs: string[] = []

  const capturedConsole = {
    log: (...args: unknown[]) => {
      logs.push(args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' '))
    },
    error: (...args: unknown[]) => {
      logs.push('[ERROR] ' + args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' '))
    },
    warn: (...args: unknown[]) => {
      logs.push('[WARN] ' + args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' '))
    },
    info: (...args: unknown[]) => {
      logs.push('[INFO] ' + args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' '))
    },
    debug: (...args: unknown[]) => {
      logs.push('[DEBUG] ' + args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' '))
    },
  } as typeof console

  return { logs, console: capturedConsole }
}

// 유틸리티 함수 (샌드박스에서 사용 가능)
const sandboxUtilities = {
  // 배열 유틸리티
  first: <T>(arr: T[]): T | undefined => arr[0],
  last: <T>(arr: T[]): T | undefined => arr[arr.length - 1],
  sum: (arr: number[]): number => arr.reduce((a, b) => a + b, 0),
  average: (arr: number[]): number => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0,
  unique: <T>(arr: T[]): T[] => [...new Set(arr)],
  flatten: <T>(arr: T[][]): T[] => arr.flat(),
  groupBy: <T>(arr: T[], key: keyof T): Record<string, T[]> => {
    return arr.reduce((acc, item) => {
      const groupKey = String(item[key])
      acc[groupKey] = acc[groupKey] || []
      acc[groupKey].push(item)
      return acc
    }, {} as Record<string, T[]>)
  },

  // 문자열 유틸리티
  capitalize: (str: string): string =>
    str.charAt(0).toUpperCase() + str.slice(1).toLowerCase(),
  truncate: (str: string, length: number): string =>
    str.length > length ? str.slice(0, length) + '...' : str,
  slugify: (str: string): string =>
    str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),

  // 날짜 유틸리티
  now: () => new Date().toISOString(),
  formatDate: (date: Date | string, format: string): string => {
    const d = typeof date === 'string' ? new Date(date) : date
    const tokens: Record<string, string> = {
      'YYYY': d.getFullYear().toString(),
      'MM': (d.getMonth() + 1).toString().padStart(2, '0'),
      'DD': d.getDate().toString().padStart(2, '0'),
      'HH': d.getHours().toString().padStart(2, '0'),
      'mm': d.getMinutes().toString().padStart(2, '0'),
      'ss': d.getSeconds().toString().padStart(2, '0'),
    }
    return format.replace(/YYYY|MM|DD|HH|mm|ss/g, match => tokens[match])
  },

  // JSON 유틸리티
  parseJSON: (str: string): unknown => {
    try {
      return JSON.parse(str)
    } catch {
      return null
    }
  },
  stringify: (obj: unknown, pretty = false): string =>
    JSON.stringify(obj, null, pretty ? 2 : 0),

  // 수학 유틸리티
  round: (num: number, decimals = 0): number =>
    Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals),
  clamp: (num: number, min: number, max: number): number =>
    Math.min(Math.max(num, min), max),

  // 객체 유틸리티
  pick: <T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> =>
    keys.reduce((acc, key) => {
      if (key in obj) acc[key] = obj[key]
      return acc
    }, {} as Pick<T, K>),
  omit: <T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> => {
    const result = { ...obj }
    keys.forEach(key => delete result[key])
    return result as Omit<T, K>
  },
  merge: <T extends object>(...objs: T[]): T =>
    Object.assign({}, ...objs),
}

export async function executeCodeNode(
  config: CodeNodeConfig,
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  const logs: string[] = []

  try {
    // 1. 코드 검증
    if (!config.code || config.code.trim() === '') {
      return {
        success: false,
        error: '실행할 코드가 없습니다',
        logs,
      }
    }

    logs.push(`[Code] Language: ${config.language || 'javascript'}`)
    logs.push(`[Code] Code length: ${config.code.length} chars`)

    // 2. 입력 데이터 준비
    const inputVariableName = config.inputVariableName || 'input'
    const inputData = {
      ...context.previousResults,
      ...context.inputs,
    }

    // 3. Console 캡처 설정
    const { logs: consoleLogs, console: capturedConsole } = createConsoleCapture()

    // 4. 샌드박스 컨텍스트 생성
    const timeout = config.timeout || 10000 // 기본 10초

    // 결과를 저장할 변수
    let __result__: unknown = undefined

    const sandbox = {
      [inputVariableName]: inputData,
      console: capturedConsole,
      ...sandboxUtilities,
      // 기본 JavaScript 전역 객체
      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Error,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      encodeURI,
      decodeURI,
      encodeURIComponent,
      decodeURIComponent,
      // 결과 저장용
      __setResult__: (val: unknown) => { __result__ = val },
    }

    // 컨텍스트 생성
    const vmContext = vm.createContext(sandbox)

    // 5. 코드 래핑 (return 문을 __setResult__로 변환)
    let wrappedCode = config.code

    // async/await 지원을 위한 래핑
    if (config.code.includes('await')) {
      wrappedCode = `
        (async () => {
          ${config.code.replace(/\breturn\s+/g, '__setResult__(')}
        })().then(r => { if (r !== undefined) __setResult__(r); })
      `
    } else if (!config.code.includes('return')) {
      // return이 없으면 마지막 표현식을 결과로
      const lines = config.code.trim().split('\n')
      const lastLine = lines.pop()
      if (lastLine && !lastLine.trim().endsWith(';') && lastLine.trim() !== '') {
        lines.push(`__setResult__(${lastLine})`)
      } else if (lastLine) {
        lines.push(lastLine)
      }
      wrappedCode = lines.join('\n')
    } else {
      // return을 __setResult__로 변환
      wrappedCode = config.code.replace(/\breturn\s+([^;]+);?/g, '__setResult__($1);')
    }

    // 6. 코드 실행
    logs.push('[Code] Executing...')

    const script = new vm.Script(wrappedCode, {
      filename: 'workflow-code.js',
    })

    // 타임아웃과 함께 실행
    script.runInContext(vmContext, {
      timeout,
      displayErrors: true,
    })

    // async 코드의 경우 잠시 대기
    if (config.code.includes('await')) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // 7. Console 로그 추가
    if (consoleLogs.length > 0) {
      logs.push('[Code] Console output:')
      logs.push(...consoleLogs.map(log => `  ${log}`))
    }

    logs.push(`[Code] Result type: ${typeof __result__}`)

    return {
      success: true,
      result: __result__,
      logs,
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (errorMessage.includes('Script execution timed out')) {
      logs.push(`[Code] Timeout after ${config.timeout || 10000}ms`)
      return {
        success: false,
        error: `코드 실행 타임아웃 (${config.timeout || 10000}ms)`,
        logs,
      }
    }

    logs.push(`[Code] Error: ${errorMessage}`)
    return {
      success: false,
      error: `코드 실행 실패: ${errorMessage}`,
      logs,
    }
  }
}
