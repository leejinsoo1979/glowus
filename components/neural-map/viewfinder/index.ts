/**
 * AI Viewfinder Module
 *
 * 드래그/리사이즈 가능한 뷰파인더로 화면의 특정 영역을 캡처하고
 * AI Vision API를 통해 실시간 분석을 수행합니다.
 *
 * @example
 * ```tsx
 * import { AIViewfinder, useViewfinder } from '@/components/neural-map/viewfinder'
 *
 * function MyComponent() {
 *   const viewfinder = useViewfinder({
 *     mode: 'manual',
 *     initialBounds: { x: 100, y: 100, width: 400, height: 300 }
 *   })
 *
 *   return (
 *     <div>
 *       <button onClick={viewfinder.toggle}>
 *         {viewfinder.isActive ? '뷰파인더 닫기' : '뷰파인더 열기'}
 *       </button>
 *
 *       <AIViewfinder
 *         isActive={viewfinder.isActive}
 *         onCapture={viewfinder.handleCapture}
 *         onAnalysis={viewfinder.handleAnalysis}
 *         onClose={viewfinder.close}
 *         mode={viewfinder.options.mode}
 *       />
 *
 *       {viewfinder.lastAnalysis && (
 *         <div className="analysis-result">
 *           {viewfinder.lastAnalysis}
 *         </div>
 *       )}
 *     </div>
 *   )
 * }
 * ```
 */

export { AIViewfinder } from './AIViewfinder'
export type {
  AIViewfinderProps,
  ViewfinderBounds,
  ViewfinderCaptureResult
} from './AIViewfinder'

export { useViewfinder } from './useViewfinder'
export type {
  UseViewfinderOptions,
  ViewfinderState,
  UseViewfinderReturn
} from './useViewfinder'
