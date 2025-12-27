'use client'

import { useEffect, useState, useCallback, useRef, DragEvent } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  ConnectionLineType,
  MarkerType,
  Handle,
  Position,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { createClient } from '@/lib/supabase/client'
import { Trash2, Save, Download, FileJson, RotateCcw, Loader2, Eye, EyeOff } from 'lucide-react'

// ===== 노드 컴포넌트들 =====

// 원 (Circle)
const CircleNode = ({ data, selected }: { data: { label: string }; selected: boolean }) => (
  <div className={cn('relative', selected && 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-zinc-900 rounded-full')}>
    <Handle type="target" position={Position.Top} className="!bg-zinc-500 !w-3 !h-3 !border-2 !border-zinc-400" />
    <div className="w-24 h-24 rounded-full flex items-center justify-center text-white font-semibold text-center shadow-lg bg-gradient-to-br from-zinc-600 to-zinc-800 border-2 border-zinc-500 p-2">
      <span className="text-sm leading-tight">{data.label || 'Circle'}</span>
    </div>
    <Handle type="source" position={Position.Bottom} className="!bg-zinc-500 !w-3 !h-3 !border-2 !border-zinc-400" />
    <Handle type="source" position={Position.Left} id="left" className="!bg-zinc-500 !w-3 !h-3 !border-2 !border-zinc-400" />
    <Handle type="source" position={Position.Right} id="right" className="!bg-zinc-500 !w-3 !h-3 !border-2 !border-zinc-400" />
  </div>
)

// 텍스트 (Text) - 직접 편집 가능
const TextNode = ({ data, selected, id }: { data: { label: string }; selected: boolean; id: string }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [text, setText] = useState(data.label || 'Text')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    setText(data.label || 'Text')
  }, [data.label])

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(true)
  }

  const handleBlur = () => {
    setIsEditing(false)
    if (text !== data.label) {
      data.label = text
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setText(data.label || 'Text')
      setIsEditing(false)
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      setIsEditing(false)
    }
  }

  return (
    <div className={cn('relative', selected && 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-zinc-900')}>
      <Handle type="target" position={Position.Top} className="!bg-zinc-500 !w-3 !h-3 !border-2 !border-zinc-400" />
      {isEditing ? (
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="px-4 py-2 text-zinc-200 text-sm min-w-[120px] min-h-[60px] border-2 border-blue-500 rounded bg-zinc-800 resize-none outline-none"
          style={{ width: Math.max(120, text.length * 8) }}
        />
      ) : (
        <div
          onDoubleClick={handleDoubleClick}
          className="px-4 py-2 text-zinc-300 text-sm min-w-[120px] min-h-[40px] border-2 border-dashed border-zinc-600 rounded bg-transparent cursor-text whitespace-pre-wrap"
        >
          {text || 'Double-click to edit'}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-zinc-500 !w-3 !h-3 !border-2 !border-zinc-400" />
    </div>
  )
}

// 커넥터 (작은 원)
const ConnectorNode = ({ data, selected }: { data: { label: string }; selected: boolean }) => (
  <div className={cn('relative', selected && 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-zinc-900 rounded-full')}>
    <Handle type="target" position={Position.Top} className="!bg-zinc-500 !w-2 !h-2 !border !border-zinc-400" />
    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-lg bg-gradient-to-br from-zinc-600 to-zinc-800 border-2 border-zinc-500">
      {data.label || 'A'}
    </div>
    <Handle type="source" position={Position.Bottom} className="!bg-zinc-500 !w-2 !h-2 !border !border-zinc-400" />
  </div>
)

// 서브루틴
const SubroutineNode = ({ data, selected }: { data: { label: string }; selected: boolean }) => (
  <div className={cn('relative', selected && 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-zinc-900 rounded')}>
    <Handle type="target" position={Position.Top} className="!bg-zinc-500 !w-3 !h-3 !border-2 !border-zinc-400" />
    <div className="relative px-8 py-4 text-white font-semibold text-center min-w-[140px] shadow-lg bg-gradient-to-br from-zinc-600 to-zinc-800 border-2 border-zinc-500 rounded">
      <div className="absolute left-2 top-0 bottom-0 w-px bg-zinc-500" />
      <div className="absolute right-2 top-0 bottom-0 w-px bg-zinc-500" />
      {data.label || 'Subroutine'}
    </div>
    <Handle type="source" position={Position.Bottom} className="!bg-zinc-500 !w-3 !h-3 !border-2 !border-zinc-400" />
  </div>
)

// 스토리지
const StorageNode = ({ data, selected }: { data: { label: string }; selected: boolean }) => (
  <div className={cn('relative', selected && 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-zinc-900')}>
    <Handle type="target" position={Position.Top} className="!bg-zinc-500 !w-3 !h-3 !border-2 !border-zinc-400" />
    <svg width="130" height="60" viewBox="0 0 130 60" className="drop-shadow-lg">
      <defs>
        <linearGradient id="storageGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#52525b" />
          <stop offset="100%" stopColor="#3f3f46" />
        </linearGradient>
      </defs>
      <path d="M20,5 Q5,30 20,55 L125,55 L125,5 Z" fill="url(#storageGrad)" stroke="#71717a" strokeWidth="2" />
      <text x="72" y="35" textAnchor="middle" fill="white" fontSize="13" fontWeight="600">{data.label || 'Storage'}</text>
    </svg>
    <Handle type="source" position={Position.Bottom} className="!bg-zinc-500 !w-3 !h-3 !border-2 !border-zinc-400" />
  </div>
)

// 딜레이
const DelayNode = ({ data, selected }: { data: { label: string }; selected: boolean }) => (
  <div className={cn('relative', selected && 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-zinc-900')}>
    <Handle type="target" position={Position.Top} className="!bg-zinc-500 !w-3 !h-3 !border-2 !border-zinc-400" />
    <svg width="130" height="60" viewBox="0 0 130 60" className="drop-shadow-lg">
      <defs>
        <linearGradient id="delayNodeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#52525b" />
          <stop offset="100%" stopColor="#3f3f46" />
        </linearGradient>
      </defs>
      <path d="M5,5 L90,5 Q125,30 90,55 L5,55 Z" fill="url(#delayNodeGrad)" stroke="#71717a" strokeWidth="2" />
      <text x="55" y="35" textAnchor="middle" fill="white" fontSize="13" fontWeight="600">{data.label || 'Delay'}</text>
    </svg>
    <Handle type="source" position={Position.Bottom} className="!bg-zinc-500 !w-3 !h-3 !border-2 !border-zinc-400" />
  </div>
)

// 코멘트/주석
const CommentNode = ({ data, selected }: { data: { label: string }; selected: boolean }) => (
  <div className={cn('relative', selected && 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-zinc-900')}>
    <div className="flex">
      <div className="w-1 bg-zinc-500 rounded-l" />
      <div className="px-4 py-3 text-zinc-400 text-sm border-t border-b border-r border-dashed border-zinc-600 bg-zinc-900/50 min-w-[120px]">
        {data.label || 'Comment'}
      </div>
    </div>
    <Handle type="target" position={Position.Left} className="!bg-zinc-500 !w-2 !h-2 !border !border-zinc-400" />
  </div>
)

// OR 게이트
const OrNode = ({ data, selected }: { data: { label: string }; selected: boolean }) => (
  <div className={cn('relative', selected && 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-zinc-900 rounded-full')}>
    <Handle type="target" position={Position.Top} className="!bg-zinc-500 !w-3 !h-3 !border-2 !border-zinc-400" />
    <svg width="60" height="60" viewBox="0 0 60 60" className="drop-shadow-lg">
      <defs>
        <linearGradient id="orNodeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#52525b" />
          <stop offset="100%" stopColor="#3f3f46" />
        </linearGradient>
      </defs>
      <circle cx="30" cy="30" r="26" fill="url(#orNodeGrad)" stroke="#71717a" strokeWidth="2" />
      <line x1="30" y1="8" x2="30" y2="52" stroke="#71717a" strokeWidth="2" />
      <line x1="8" y1="30" x2="52" y2="30" stroke="#71717a" strokeWidth="2" />
    </svg>
    <Handle type="source" position={Position.Bottom} className="!bg-zinc-500 !w-3 !h-3 !border-2 !border-zinc-400" />
    <Handle type="source" position={Position.Left} id="left" className="!bg-zinc-500 !w-3 !h-3 !border-2 !border-zinc-400" />
    <Handle type="source" position={Position.Right} id="right" className="!bg-zinc-500 !w-3 !h-3 !border-2 !border-zinc-400" />
  </div>
)

// Merge (역삼각형)
const MergeNode = ({ data, selected }: { data: { label: string }; selected: boolean }) => (
  <div className={cn('relative', selected && 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-zinc-900')}>
    <Handle type="target" position={Position.Top} className="!bg-zinc-500 !w-3 !h-3 !border-2 !border-zinc-400" />
    <Handle type="target" position={Position.Left} id="left" className="!bg-zinc-500 !w-3 !h-3 !border-2 !border-zinc-400" />
    <Handle type="target" position={Position.Right} id="right" className="!bg-zinc-500 !w-3 !h-3 !border-2 !border-zinc-400" />
    <svg width="100" height="70" viewBox="0 0 100 70" className="drop-shadow-lg">
      <defs>
        <linearGradient id="mergeNodeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#52525b" />
          <stop offset="100%" stopColor="#3f3f46" />
        </linearGradient>
      </defs>
      <polygon points="50,65 5,5 95,5" fill="url(#mergeNodeGrad)" stroke="#71717a" strokeWidth="2" />
      <text x="50" y="30" textAnchor="middle" fill="white" fontSize="11" fontWeight="600">{data.label || 'Merge'}</text>
    </svg>
    <Handle type="source" position={Position.Bottom} className="!bg-zinc-500 !w-3 !h-3 !border-2 !border-zinc-400" />
  </div>
)

// 시작/종료 (타원)
const TerminalNode = ({ data, selected }: { data: { label: string }; selected: boolean }) => (
  <div className={cn('relative', selected && 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-zinc-900 rounded-full')}>
    <Handle type="target" position={Position.Top} className="!bg-emerald-500 !w-3 !h-3 !border-2 !border-emerald-300" />
    <div className="px-8 py-4 rounded-full text-white font-semibold text-center min-w-[120px] shadow-lg bg-gradient-to-br from-emerald-500 to-emerald-700 border-2 border-emerald-400">
      {data.label || 'Start'}
    </div>
    <Handle type="source" position={Position.Bottom} className="!bg-emerald-500 !w-3 !h-3 !border-2 !border-emerald-300" />
  </div>
)

// 프로세스 (사각형)
const ProcessNode = ({ data, selected }: { data: { label: string }; selected: boolean }) => (
  <div className={cn('relative', selected && 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-zinc-900 rounded-lg')}>
    <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3 !border-2 !border-blue-300" />
    <div className="px-6 py-4 rounded-lg text-white font-semibold text-center min-w-[140px] shadow-lg bg-gradient-to-br from-blue-500 to-blue-700 border-2 border-blue-400">
      {data.label || 'Process'}
    </div>
    <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3 !border-2 !border-blue-300" />
  </div>
)

// 결정 (다이아몬드)
const DecisionNode = ({ data, selected }: { data: { label: string }; selected: boolean }) => (
  <div className={cn('relative', selected && 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-zinc-900')}>
    <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-3 !h-3 !-top-1 !border-2 !border-amber-300" />
    <svg width="140" height="100" viewBox="0 0 140 100" className="drop-shadow-lg">
      <defs>
        <linearGradient id="decisionGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <polygon points="70,5 135,50 70,95 5,50" fill="url(#decisionGrad)" stroke="#fbbf24" strokeWidth="3" />
      <text x="70" y="55" textAnchor="middle" fill="white" fontSize="13" fontWeight="600">{data.label || 'Decision'}</text>
    </svg>
    <Handle type="source" position={Position.Bottom} className="!bg-amber-500 !w-3 !h-3 !-bottom-1 !border-2 !border-amber-300" />
    <Handle type="source" position={Position.Left} id="left" className="!bg-amber-500 !w-3 !h-3 !border-2 !border-amber-300" />
    <Handle type="source" position={Position.Right} id="right" className="!bg-amber-500 !w-3 !h-3 !border-2 !border-amber-300" />
  </div>
)

// 데이터 (평행사변형)
const DataNode = ({ data, selected }: { data: { label: string }; selected: boolean }) => (
  <div className={cn('relative', selected && 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-zinc-900')}>
    <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-3 !h-3 !border-2 !border-purple-300" />
    <svg width="150" height="60" viewBox="0 0 150 60" className="drop-shadow-lg">
      <defs>
        <linearGradient id="dataGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <polygon points="20,5 145,5 130,55 5,55" fill="url(#dataGrad)" stroke="#c084fc" strokeWidth="3" />
      <text x="75" y="35" textAnchor="middle" fill="white" fontSize="13" fontWeight="600">{data.label || 'Data'}</text>
    </svg>
    <Handle type="source" position={Position.Bottom} className="!bg-purple-500 !w-3 !h-3 !border-2 !border-purple-300" />
  </div>
)

// 문서 (물결 하단)
const DocumentNode = ({ data, selected }: { data: { label: string }; selected: boolean }) => (
  <div className={cn('relative', selected && 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-zinc-900')}>
    <Handle type="target" position={Position.Top} className="!bg-pink-500 !w-3 !h-3 !border-2 !border-pink-300" />
    <svg width="130" height="80" viewBox="0 0 130 80" className="drop-shadow-lg">
      <defs>
        <linearGradient id="docGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#be185d" />
        </linearGradient>
      </defs>
      <path d="M5,5 L125,5 L125,60 Q97,75 65,60 Q33,45 5,60 Z" fill="url(#docGrad)" stroke="#f472b6" strokeWidth="3" />
      <text x="65" y="38" textAnchor="middle" fill="white" fontSize="13" fontWeight="600">{data.label || 'Document'}</text>
    </svg>
    <Handle type="source" position={Position.Bottom} className="!bg-pink-500 !w-3 !h-3 !border-2 !border-pink-300" />
  </div>
)

// 데이터베이스 (실린더)
const DatabaseNode = ({ data, selected }: { data: { label: string }; selected: boolean }) => (
  <div className={cn('relative', selected && 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-zinc-900')}>
    <Handle type="target" position={Position.Top} className="!bg-cyan-500 !w-3 !h-3 !-top-1 !border-2 !border-cyan-300" />
    <svg width="100" height="80" viewBox="0 0 100 80" className="drop-shadow-lg">
      <defs>
        <linearGradient id="dbGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="15" rx="45" ry="12" fill="url(#dbGrad)" stroke="#22d3ee" strokeWidth="2" />
      <rect x="5" y="15" width="90" height="50" fill="url(#dbGrad)" />
      <line x1="5" y1="15" x2="5" y2="65" stroke="#22d3ee" strokeWidth="2" />
      <line x1="95" y1="15" x2="95" y2="65" stroke="#22d3ee" strokeWidth="2" />
      <ellipse cx="50" cy="65" rx="45" ry="12" fill="url(#dbGrad)" stroke="#22d3ee" strokeWidth="2" />
      <text x="50" y="45" textAnchor="middle" fill="white" fontSize="12" fontWeight="600">{data.label || 'Database'}</text>
    </svg>
    <Handle type="source" position={Position.Bottom} className="!bg-cyan-500 !w-3 !h-3 !-bottom-1 !border-2 !border-cyan-300" />
  </div>
)

// 수동 입력 (사다리꼴)
const InputNode = ({ data, selected }: { data: { label: string }; selected: boolean }) => (
  <div className={cn('relative', selected && 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-zinc-900')}>
    <Handle type="target" position={Position.Top} className="!bg-rose-500 !w-3 !h-3 !border-2 !border-rose-300" />
    <svg width="140" height="60" viewBox="0 0 140 60" className="drop-shadow-lg">
      <defs>
        <linearGradient id="inputGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f43f5e" />
          <stop offset="100%" stopColor="#be123c" />
        </linearGradient>
      </defs>
      <polygon points="15,5 125,5 135,55 5,55" fill="url(#inputGrad)" stroke="#fb7185" strokeWidth="3" />
      <text x="70" y="35" textAnchor="middle" fill="white" fontSize="13" fontWeight="600">{data.label || 'Input'}</text>
    </svg>
    <Handle type="source" position={Position.Bottom} className="!bg-rose-500 !w-3 !h-3 !border-2 !border-rose-300" />
  </div>
)

// 준비 (육각형)
const PrepareNode = ({ data, selected }: { data: { label: string }; selected: boolean }) => (
  <div className={cn('relative', selected && 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-zinc-900')}>
    <Handle type="target" position={Position.Top} className="!bg-indigo-500 !w-3 !h-3 !border-2 !border-indigo-300" />
    <svg width="150" height="70" viewBox="0 0 150 70" className="drop-shadow-lg">
      <defs>
        <linearGradient id="prepGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
      <polygon points="25,0 125,0 150,35 125,70 25,70 0,35" fill="url(#prepGrad)" stroke="#818cf8" strokeWidth="3" />
      <text x="75" y="40" textAnchor="middle" fill="white" fontSize="13" fontWeight="600">{data.label || 'Prepare'}</text>
    </svg>
    <Handle type="source" position={Position.Bottom} className="!bg-indigo-500 !w-3 !h-3 !border-2 !border-indigo-300" />
  </div>
)

// 디스플레이 (물결 양쪽)
const DisplayNode = ({ data, selected }: { data: { label: string }; selected: boolean }) => (
  <div className={cn('relative', selected && 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-zinc-900')}>
    <Handle type="target" position={Position.Top} className="!bg-teal-500 !w-3 !h-3 !border-2 !border-teal-300" />
    <svg width="140" height="60" viewBox="0 0 140 60" className="drop-shadow-lg">
      <defs>
        <linearGradient id="dispGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <path d="M15,5 Q0,30 15,55 L125,55 Q140,30 125,5 Z" fill="url(#dispGrad)" stroke="#2dd4bf" strokeWidth="3" />
      <text x="70" y="35" textAnchor="middle" fill="white" fontSize="13" fontWeight="600">{data.label || 'Display'}</text>
    </svg>
    <Handle type="source" position={Position.Bottom} className="!bg-teal-500 !w-3 !h-3 !border-2 !border-teal-300" />
  </div>
)

const nodeTypes = {
  // 기본 도형
  circle: CircleNode,
  text: TextNode,
  connector: ConnectorNode,
  // 플로우차트 기본
  terminal: TerminalNode,
  process: ProcessNode,
  decision: DecisionNode,
  subroutine: SubroutineNode,
  // 데이터 관련
  data: DataNode,
  document: DocumentNode,
  database: DatabaseNode,
  storage: StorageNode,
  // 입출력
  input: InputNode,
  display: DisplayNode,
  // 기타
  prepare: PrepareNode,
  delay: DelayNode,
  comment: CommentNode,
  or: OrNode,
  merge: MergeNode,
}

// 도형 라이브러리 - 모노톤 프로페셔널 디자인
const shapeLibrary = [
  // ===== 기본 도형 =====
  {
    type: 'circle',
    label: 'Circle',
    color: '#71717a',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full">
        <defs>
          <linearGradient id="circleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#52525b" />
            <stop offset="100%" stopColor="#3f3f46" />
          </linearGradient>
        </defs>
        <circle cx="24" cy="24" r="21" fill="url(#circleGrad)" />
        <circle cx="24" cy="24" r="21" fill="none" stroke="#71717a" strokeWidth="1.5" />
        <ellipse cx="24" cy="16" rx="14" ry="6" fill="rgba(255,255,255,0.08)" />
      </svg>
    ),
  },
  {
    type: 'text',
    label: 'Text',
    color: '#71717a',
    svg: (
      <svg viewBox="0 0 72 36" className="w-full h-full">
        <rect x="3" y="3" width="66" height="30" fill="transparent" stroke="#71717a" strokeWidth="1.5" strokeDasharray="4 2" />
        <text x="36" y="22" textAnchor="middle" fill="#a1a1aa" fontSize="12" fontWeight="500">Text</text>
      </svg>
    ),
  },
  {
    type: 'connector',
    label: 'Connector',
    color: '#71717a',
    svg: (
      <svg viewBox="0 0 36 36" className="w-full h-full">
        <defs>
          <linearGradient id="connGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#52525b" />
            <stop offset="100%" stopColor="#3f3f46" />
          </linearGradient>
        </defs>
        <circle cx="18" cy="18" r="14" fill="url(#connGrad)" />
        <circle cx="18" cy="18" r="14" fill="none" stroke="#71717a" strokeWidth="1.5" />
        <circle cx="18" cy="14" r="8" fill="rgba(255,255,255,0.08)" />
      </svg>
    ),
  },
  // ===== 플로우차트 기본 =====
  {
    type: 'terminal',
    label: 'Start/End',
    color: '#71717a',
    svg: (
      <svg viewBox="0 0 72 36" className="w-full h-full">
        <defs>
          <linearGradient id="monoGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#52525b" />
            <stop offset="100%" stopColor="#3f3f46" />
          </linearGradient>
        </defs>
        <rect x="3" y="3" width="66" height="30" rx="15" fill="url(#monoGrad1)" />
        <rect x="3" y="3" width="66" height="30" rx="15" fill="none" stroke="#71717a" strokeWidth="1.5" />
        <rect x="8" y="8" width="56" height="10" rx="5" fill="rgba(255,255,255,0.08)" />
      </svg>
    ),
  },
  {
    type: 'process',
    label: 'Process',
    color: '#71717a',
    svg: (
      <svg viewBox="0 0 72 36" className="w-full h-full">
        <defs>
          <linearGradient id="monoGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#52525b" />
            <stop offset="100%" stopColor="#3f3f46" />
          </linearGradient>
        </defs>
        <rect x="3" y="3" width="66" height="30" rx="4" fill="url(#monoGrad2)" />
        <rect x="3" y="3" width="66" height="30" rx="4" fill="none" stroke="#71717a" strokeWidth="1.5" />
        <rect x="8" y="8" width="56" height="10" rx="2" fill="rgba(255,255,255,0.08)" />
      </svg>
    ),
  },
  {
    type: 'decision',
    label: 'Decision',
    color: '#71717a',
    svg: (
      <svg viewBox="0 0 72 48" className="w-full h-full">
        <defs>
          <linearGradient id="monoGrad3" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#52525b" />
            <stop offset="100%" stopColor="#3f3f46" />
          </linearGradient>
        </defs>
        <polygon points="36,4 68,24 36,44 4,24" fill="url(#monoGrad3)" />
        <polygon points="36,4 68,24 36,44 4,24" fill="none" stroke="#71717a" strokeWidth="1.5" />
        <polygon points="36,10 54,24 36,24 18,24" fill="rgba(255,255,255,0.08)" />
      </svg>
    ),
  },
  {
    type: 'subroutine',
    label: 'Subroutine',
    color: '#71717a',
    svg: (
      <svg viewBox="0 0 72 36" className="w-full h-full">
        <defs>
          <linearGradient id="subGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#52525b" />
            <stop offset="100%" stopColor="#3f3f46" />
          </linearGradient>
        </defs>
        <rect x="3" y="3" width="66" height="30" rx="2" fill="url(#subGrad)" />
        <rect x="3" y="3" width="66" height="30" rx="2" fill="none" stroke="#71717a" strokeWidth="1.5" />
        <line x1="10" y1="3" x2="10" y2="33" stroke="#71717a" strokeWidth="1.5" />
        <line x1="62" y1="3" x2="62" y2="33" stroke="#71717a" strokeWidth="1.5" />
        <rect x="12" y="8" width="48" height="8" fill="rgba(255,255,255,0.08)" />
      </svg>
    ),
  },
  // ===== 데이터 관련 =====
  {
    type: 'data',
    label: 'Data I/O',
    color: '#71717a',
    svg: (
      <svg viewBox="0 0 72 36" className="w-full h-full">
        <defs>
          <linearGradient id="monoGrad4" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#52525b" />
            <stop offset="100%" stopColor="#3f3f46" />
          </linearGradient>
        </defs>
        <polygon points="14,3 69,3 58,33 3,33" fill="url(#monoGrad4)" />
        <polygon points="14,3 69,3 58,33 3,33" fill="none" stroke="#71717a" strokeWidth="1.5" />
        <polygon points="17,8 60,8 55,16 12,16" fill="rgba(255,255,255,0.08)" />
      </svg>
    ),
  },
  {
    type: 'document',
    label: 'Document',
    color: '#71717a',
    svg: (
      <svg viewBox="0 0 72 44" className="w-full h-full">
        <defs>
          <linearGradient id="monoGrad5" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#52525b" />
            <stop offset="100%" stopColor="#3f3f46" />
          </linearGradient>
        </defs>
        <path d="M3,3 L69,3 L69,32 Q52,42 36,32 Q20,22 3,32 Z" fill="url(#monoGrad5)" />
        <path d="M3,3 L69,3 L69,32 Q52,42 36,32 Q20,22 3,32 Z" fill="none" stroke="#71717a" strokeWidth="1.5" />
        <rect x="8" y="8" width="56" height="10" fill="rgba(255,255,255,0.08)" />
      </svg>
    ),
  },
  {
    type: 'database',
    label: 'Database',
    color: '#71717a',
    svg: (
      <svg viewBox="0 0 60 48" className="w-full h-full">
        <defs>
          <linearGradient id="monoGrad6" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#52525b" />
            <stop offset="100%" stopColor="#3f3f46" />
          </linearGradient>
        </defs>
        <ellipse cx="30" cy="12" rx="26" ry="9" fill="url(#monoGrad6)" />
        <rect x="4" y="12" width="52" height="24" fill="#3f3f46" />
        <ellipse cx="30" cy="36" rx="26" ry="9" fill="url(#monoGrad6)" />
        <ellipse cx="30" cy="12" rx="26" ry="9" fill="none" stroke="#71717a" strokeWidth="1.5" />
        <line x1="4" y1="12" x2="4" y2="36" stroke="#71717a" strokeWidth="1.5" />
        <line x1="56" y1="12" x2="56" y2="36" stroke="#71717a" strokeWidth="1.5" />
        <ellipse cx="30" cy="36" rx="26" ry="9" fill="none" stroke="#71717a" strokeWidth="1.5" />
        <ellipse cx="30" cy="12" rx="20" ry="5" fill="rgba(255,255,255,0.08)" />
      </svg>
    ),
  },
  {
    type: 'storage',
    label: 'Storage',
    color: '#71717a',
    svg: (
      <svg viewBox="0 0 72 36" className="w-full h-full">
        <defs>
          <linearGradient id="storGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#52525b" />
            <stop offset="100%" stopColor="#3f3f46" />
          </linearGradient>
        </defs>
        <path d="M12,3 Q3,18 12,33 L69,33 L69,3 Z" fill="url(#storGrad)" />
        <path d="M12,3 Q3,18 12,33 L69,33 L69,3 Z" fill="none" stroke="#71717a" strokeWidth="1.5" />
        <path d="M14,8 Q8,16 14,16 L65,16 L65,8 Z" fill="rgba(255,255,255,0.08)" />
      </svg>
    ),
  },
  // ===== 입출력 =====
  {
    type: 'input',
    label: 'Manual Input',
    color: '#71717a',
    svg: (
      <svg viewBox="0 0 72 36" className="w-full h-full">
        <defs>
          <linearGradient id="monoGrad7" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#52525b" />
            <stop offset="100%" stopColor="#3f3f46" />
          </linearGradient>
        </defs>
        <polygon points="10,3 62,3 69,33 3,33" fill="url(#monoGrad7)" />
        <polygon points="10,3 62,3 69,33 3,33" fill="none" stroke="#71717a" strokeWidth="1.5" />
        <polygon points="13,8 58,8 62,16 9,16" fill="rgba(255,255,255,0.08)" />
      </svg>
    ),
  },
  {
    type: 'display',
    label: 'Display',
    color: '#71717a',
    svg: (
      <svg viewBox="0 0 72 36" className="w-full h-full">
        <defs>
          <linearGradient id="monoGrad9" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#52525b" />
            <stop offset="100%" stopColor="#3f3f46" />
          </linearGradient>
        </defs>
        <path d="M12,3 Q2,18 12,33 L60,33 Q70,18 60,3 Z" fill="url(#monoGrad9)" />
        <path d="M12,3 Q2,18 12,33 L60,33 Q70,18 60,3 Z" fill="none" stroke="#71717a" strokeWidth="1.5" />
        <path d="M14,8 Q6,16 14,16 L58,16 Q66,16 58,8 Z" fill="rgba(255,255,255,0.08)" />
      </svg>
    ),
  },
  // ===== 기타 =====
  {
    type: 'prepare',
    label: 'Prepare',
    color: '#71717a',
    svg: (
      <svg viewBox="0 0 72 40" className="w-full h-full">
        <defs>
          <linearGradient id="monoGrad8" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#52525b" />
            <stop offset="100%" stopColor="#3f3f46" />
          </linearGradient>
        </defs>
        <polygon points="14,3 58,3 69,20 58,37 14,37 3,20" fill="url(#monoGrad8)" />
        <polygon points="14,3 58,3 69,20 58,37 14,37 3,20" fill="none" stroke="#71717a" strokeWidth="1.5" />
        <polygon points="17,8 55,8 62,16 55,16 17,16 10,16" fill="rgba(255,255,255,0.08)" />
      </svg>
    ),
  },
  {
    type: 'delay',
    label: 'Delay',
    color: '#71717a',
    svg: (
      <svg viewBox="0 0 72 36" className="w-full h-full">
        <defs>
          <linearGradient id="delayGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#52525b" />
            <stop offset="100%" stopColor="#3f3f46" />
          </linearGradient>
        </defs>
        <path d="M3,3 L50,3 Q69,18 50,33 L3,33 Z" fill="url(#delayGrad)" />
        <path d="M3,3 L50,3 Q69,18 50,33 L3,33 Z" fill="none" stroke="#71717a" strokeWidth="1.5" />
        <path d="M8,8 L45,8 Q58,14 45,16 L8,16 Z" fill="rgba(255,255,255,0.08)" />
      </svg>
    ),
  },
  {
    type: 'comment',
    label: 'Comment',
    color: '#71717a',
    svg: (
      <svg viewBox="0 0 72 36" className="w-full h-full">
        <line x1="10" y1="3" x2="10" y2="33" stroke="#71717a" strokeWidth="2" />
        <line x1="10" y1="3" x2="69" y2="3" stroke="#71717a" strokeWidth="1.5" strokeDasharray="4 2" />
        <line x1="10" y1="33" x2="69" y2="33" stroke="#71717a" strokeWidth="1.5" strokeDasharray="4 2" />
        <text x="20" y="22" fill="#a1a1aa" fontSize="10">Note</text>
      </svg>
    ),
  },
  {
    type: 'or',
    label: 'OR',
    color: '#71717a',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full">
        <defs>
          <linearGradient id="orGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#52525b" />
            <stop offset="100%" stopColor="#3f3f46" />
          </linearGradient>
        </defs>
        <circle cx="24" cy="24" r="18" fill="url(#orGrad)" />
        <circle cx="24" cy="24" r="18" fill="none" stroke="#71717a" strokeWidth="1.5" />
        <line x1="24" y1="8" x2="24" y2="40" stroke="#71717a" strokeWidth="1.5" />
        <line x1="8" y1="24" x2="40" y2="24" stroke="#71717a" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    type: 'merge',
    label: 'Merge',
    color: '#71717a',
    svg: (
      <svg viewBox="0 0 72 48" className="w-full h-full">
        <defs>
          <linearGradient id="mergeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#52525b" />
            <stop offset="100%" stopColor="#3f3f46" />
          </linearGradient>
        </defs>
        <polygon points="36,44 4,4 68,4" fill="url(#mergeGrad)" />
        <polygon points="36,44 4,4 68,4" fill="none" stroke="#71717a" strokeWidth="1.5" />
        <polygon points="36,20 20,6 52,6" fill="rgba(255,255,255,0.08)" />
      </svg>
    ),
  },
]

interface MermaidViewProps {
  className?: string
}

let nodeId = Date.now()
const getNodeId = () => `node_${nodeId++}`

function FlowEditor() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, fitView } = useReactFlow()
  const projectPath = useNeuralMapStore((s) => s.projectPath)

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNodes, setSelectedNodes] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [edgeType, setEdgeType] = useState<'default' | 'straight' | 'step' | 'smoothstep'>('smoothstep')
  const [edgeAnimated, setEdgeAnimated] = useState(true)
  const [showMiniMap, setShowMiniMap] = useState(true)

  // 플로우차트 ID (프로젝트 경로 기반) - 한글 등 비ASCII 문자 지원
  const flowchartId = projectPath
    ? btoa(encodeURIComponent(projectPath)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 50)
    : 'default'

  // DB에서 불러오기
  const loadFromDB = useCallback(async () => {
    if (!flowchartId) return

    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('flowcharts')
        .select('nodes, edges, updated_at')
        .eq('id', flowchartId)
        .single()

      if (data && !error) {
        const flowchartData = data as { nodes: Node[]; edges: Edge[]; updated_at: string }
        setNodes(flowchartData.nodes || [])
        setEdges(flowchartData.edges || [])
        setLastSaved(new Date(flowchartData.updated_at))
      }
    } catch (err) {
      console.error('Failed to load flowchart:', err)
    } finally {
      setIsLoading(false)
    }
  }, [flowchartId, setNodes, setEdges])

  // DB에 저장
  const saveToDB = useCallback(async () => {
    if (!flowchartId) return

    setIsSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('flowcharts')
        .upsert({
          id: flowchartId,
          project_path: projectPath,
          nodes: nodes as unknown,
          edges: edges as unknown,
          updated_at: new Date().toISOString(),
        } as never)

      if (!error) {
        setLastSaved(new Date())
      }
    } catch (err) {
      console.error('Failed to save flowchart:', err)
    } finally {
      setIsSaving(false)
    }
  }, [flowchartId, projectPath, nodes, edges])

  // 초기 로드
  useEffect(() => {
    loadFromDB()
  }, [loadFromDB])

  // 🔥 Supabase Realtime 구독 - 에이전트 업데이트 시 자동 동기화
  useEffect(() => {
    if (!flowchartId) return

    const supabase = createClient()

    // Realtime 채널 구독
    const channel = supabase
      .channel(`flowchart-${flowchartId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'flowcharts',
          filter: `id=eq.${flowchartId}`,
        },
        (payload) => {
          console.log('[MermaidView] Realtime update received:', payload)
          // 다른 소스에서 변경된 경우에만 리로드 (자신이 저장한 것은 무시)
          if (payload.new) {
            const newData = payload.new as { nodes: Node[]; edges: Edge[]; updated_at: string }
            const serverTime = new Date(newData.updated_at).getTime()
            const localTime = lastSaved?.getTime() || 0

            // 서버 데이터가 로컬보다 새로운 경우에만 업데이트
            if (serverTime > localTime + 1000) {
              setNodes(newData.nodes || [])
              setEdges(newData.edges || [])
              setLastSaved(new Date(newData.updated_at))
              console.log('[MermaidView] Synced from server')
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [flowchartId, lastSaved, setNodes, setEdges])

  // 자동 저장 (변경 후 2초)
  useEffect(() => {
    if (nodes.length === 0 && edges.length === 0) return

    const timer = setTimeout(() => {
      saveToDB()
    }, 2000)

    return () => clearTimeout(timer)
  }, [nodes, edges, saveToDB])

  // 연결 생성
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: edgeType,
            animated: edgeAnimated,
            style: { stroke: '#60a5fa', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#60a5fa' },
          },
          eds
        )
      )
    },
    [setEdges, edgeType, edgeAnimated]
  )

  // 드래그 앤 드롭
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault()
      const type = event.dataTransfer.getData('application/reactflow')
      if (!type) return

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const shape = shapeLibrary.find((s) => s.type === type)

      const newNode: Node = {
        id: getNodeId(),
        type,
        position,
        data: { label: shape?.label || type },
      }

      setNodes((nds) => nds.concat(newNode))
    },
    [screenToFlowPosition, setNodes]
  )

  // 노드 더블클릭 - 라벨 수정
  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const newLabel = prompt('노드 이름 입력:', node.data.label)
      if (newLabel !== null && newLabel !== node.data.label) {
        setNodes((nds) => nds.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, label: newLabel } } : n)))
      }
    },
    [setNodes]
  )

  // 선택 변경
  const onSelectionChange = useCallback(({ nodes: selectedNodesList }: { nodes: Node[] }) => {
    setSelectedNodes(selectedNodesList.map((n) => n.id))
  }, [])

  // 선택된 노드 삭제
  const deleteSelected = useCallback(() => {
    if (selectedNodes.length > 0) {
      setNodes((nds) => nds.filter((n) => !selectedNodes.includes(n.id)))
      setEdges((eds) => eds.filter((e) => !selectedNodes.includes(e.source) && !selectedNodes.includes(e.target)))
      setSelectedNodes([])
    }
  }, [selectedNodes, setNodes, setEdges])

  // 키보드 이벤트
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodes.length > 0) {
        e.preventDefault()
        deleteSelected()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        saveToDB()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteSelected, saveToDB, selectedNodes])

  // 초기화
  const clearCanvas = useCallback(() => {
    if (confirm('모든 노드와 연결을 삭제하시겠습니까?')) {
      setNodes([])
      setEdges([])
    }
  }, [setNodes, setEdges])

  // JSON 내보내기
  const exportJSON = useCallback(() => {
    const data = JSON.stringify({ nodes, edges }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `flowchart-${flowchartId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [nodes, edges, flowchartId])

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* 좌측 도형 라이브러리 */}
      <div className={cn('w-48 shrink-0 border-r relative', isDark ? 'bg-zinc-900/95 border-zinc-800' : 'bg-zinc-50 border-zinc-200')}>
        {/* 헤더 */}
        <div className={cn('absolute top-0 left-0 right-0 px-3 py-2 border-b font-medium text-sm flex items-center justify-between z-10', isDark ? 'border-zinc-800 text-zinc-200 bg-zinc-900' : 'border-zinc-200 text-zinc-700 bg-zinc-50')}>
          <span>Shapes</span>
          <span className={cn('text-xs px-1.5 py-0.5 rounded', isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-200 text-zinc-500')}>
            {shapeLibrary.length}
          </span>
        </div>

        {/* 엣지 타입 선택 - 상단 */}
        <div className={cn('absolute top-[41px] left-0 right-0 px-2 py-2 border-b space-y-1 z-10', isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50')}>
          <div className={cn('text-[10px] font-medium', isDark ? 'text-zinc-400' : 'text-zinc-600')}>Connection</div>
          <div className="grid grid-cols-4 gap-1">
            {(['smoothstep', 'default', 'straight', 'step'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setEdgeType(type)}
                className={cn(
                  'px-1 py-1 rounded text-[9px] font-medium transition-colors',
                  edgeType === type
                    ? 'bg-blue-600 text-white'
                    : isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                )}
              >
                {type === 'default' ? 'Curve' : type === 'smoothstep' ? 'Smooth' : type === 'straight' ? 'Line' : 'Step'}
              </button>
            ))}
          </div>
          <label className={cn('flex items-center gap-1.5 text-[10px] cursor-pointer', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
            <input
              type="checkbox"
              checked={edgeAnimated}
              onChange={(e) => setEdgeAnimated(e.target.checked)}
              className="w-3 h-3 rounded"
            />
            Animated
          </label>
        </div>

        {/* 도형 그리드 - 스크롤 가능 */}
        <div
          className="absolute left-0 right-0 bottom-[52px] top-[115px] overflow-y-auto p-2"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#52525b #27272a'
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            {shapeLibrary.map((shape) => (
              <div
                key={shape.type}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', shape.type)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                className={cn(
                  'flex flex-col items-center p-2 rounded-lg cursor-grab active:cursor-grabbing transition-all hover:scale-105 active:scale-95',
                  isDark ? 'bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/50' : 'bg-white hover:bg-zinc-100 border border-zinc-200 shadow-sm'
                )}
              >
                <div className="w-14 h-10 mb-2">{shape.svg}</div>
                <span className={cn('text-[10px] text-center leading-tight', isDark ? 'text-zinc-400' : 'text-zinc-600')}>{shape.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 하단 패널 - 액션 버튼들 */}
        <div className={cn('absolute bottom-0 left-0 right-0 p-2 border-t space-y-1', isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50')}>
          {/* 삭제 버튼 */}
          {selectedNodes.length > 0 && (
            <button
              onClick={deleteSelected}
              className="w-full flex items-center justify-center gap-1 px-2 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded text-xs font-medium"
            >
              <Trash2 className="w-3 h-3" />
              Delete ({selectedNodes.length})
            </button>
          )}

          {/* 액션 버튼들 */}
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={saveToDB}
              disabled={isSaving}
              className={cn(
                'flex items-center justify-center gap-1 px-1 py-1.5 rounded text-[10px] font-medium',
                isDark ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
              )}
            >
              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            </button>
            <button
              onClick={exportJSON}
              className={cn(
                'flex items-center justify-center gap-1 px-1 py-1.5 rounded text-[10px] font-medium',
                isDark ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300' : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-700'
              )}
            >
              <Download className="w-3 h-3" />
            </button>
            <button
              onClick={clearCanvas}
              className={cn(
                'flex items-center justify-center gap-1 px-1 py-1.5 rounded text-[10px] font-medium',
                isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
              )}
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 캔버스 */}
      <div className="flex-1 relative" ref={reactFlowWrapper}>
        {isLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
          </div>
        )}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeDoubleClick={onNodeDoubleClick}
          onSelectionChange={onSelectionChange}
          nodeTypes={nodeTypes}
          snapToGrid
          snapGrid={[20, 20]}
          multiSelectionKeyCode="Shift"
          selectionOnDrag
          panOnDrag={[1, 2]}
          selectNodesOnDrag={false}
          defaultEdgeOptions={{ type: 'smoothstep', animated: true }}
          connectionLineStyle={{ stroke: '#60a5fa', strokeWidth: 2 }}
          connectionLineType={ConnectionLineType.SmoothStep}
          minZoom={0.1}
          maxZoom={4}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          translateExtent={[[-5000, -5000], [5000, 5000]]}
          nodeExtent={[[-5000, -5000], [5000, 5000]]}
        >
          <Background color={isDark ? '#27272a' : '#d4d4d8'} gap={20} size={1} />
          <Controls className={isDark ? '[&>button]:bg-zinc-800 [&>button]:border-zinc-700 [&>button]:text-zinc-300 [&>button:hover]:bg-zinc-700' : ''} />
          {showMiniMap && (
            <MiniMap
              nodeColor={(node) => shapeLibrary.find((s) => s.type === node.type)?.color || '#71717a'}
              className={isDark ? 'bg-zinc-900/90 border-zinc-700' : ''}
              maskColor={isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)'}
              pannable
              zoomable
            />
          )}
        </ReactFlow>
        {/* 미니맵 토글 버튼 */}
        <button
          onClick={() => setShowMiniMap(!showMiniMap)}
          className={cn(
            'absolute top-4 right-4 z-10 p-2 rounded-lg shadow-lg transition-all',
            isDark
              ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
              : 'bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200'
          )}
          title={showMiniMap ? '미니맵 숨기기' : '미니맵 보기'}
        >
          {showMiniMap ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

export function MermaidView({ className }: MermaidViewProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <div className={cn('flex flex-col h-full w-full', className)}>
      {/* 툴바 */}
      <div className={cn('flex items-center justify-between px-4 py-2 border-b shrink-0', isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200')}>
        <div className="flex items-center gap-3">
          <span className={cn('text-sm font-semibold', isDark ? 'text-zinc-200' : 'text-zinc-800')}>Flowchart Editor</span>
          <div className={cn('h-4 w-px', isDark ? 'bg-zinc-700' : 'bg-zinc-300')} />
          <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
            Drag shapes • Double-click to rename • Shift+drag to select • Delete key to remove • Cmd+S to save
          </span>
        </div>
      </div>

      {/* 에디터 */}
      <div className="flex-1">
        <ReactFlowProvider>
          <FlowEditor />
        </ReactFlowProvider>
      </div>
    </div>
  )
}

export default MermaidView
