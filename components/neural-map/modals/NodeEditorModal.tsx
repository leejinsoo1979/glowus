'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { NODE_COLORS } from '@/lib/neural-map/constants'
import { EDGE_TYPE_LABELS } from '@/lib/neural-map/types'
import type {
  NodeType,
  NeuralNode,
  NeuronScope,
  NeuronStatus,
  EnforcementLevel,
  EdgeType,
  NeuralEdge
} from '@/lib/neural-map/types'
import {
  X,
  Sparkles,
  Lightbulb,
  FolderOpen,
  FileText,
  CheckSquare,
  User,
  Brain,
  GitBranch,
  Zap,
  Loader2,
  ChevronDown,
  ChevronUp,
  Plus,
  Link,
  Shield,
  Heart,
  BookOpen,
  Target,
  AlertTriangle,
  Search,
  Trash2,
} from 'lucide-react'

interface NodeEditorModalProps {
  mapId: string | null
  onClose: () => void
  editingNode?: NeuralNode | null
}

// ============================================
// Node Type Options with Brain Core Types
// ============================================
const NODE_TYPE_OPTIONS: {
  value: NodeType
  label: string
  icon: React.ReactNode
  description: string
  category: 'brain' | 'content' | 'action' | 'entity'
}[] = [
  // Brain Core Types (NEW)
  { value: 'rule', label: '규칙', icon: <Shield className="w-4 h-4" />, description: '지켜야 할 규칙', category: 'brain' },
  { value: 'identity', label: '정체성', icon: <Target className="w-4 h-4" />, description: '가치/금기/품질 기준', category: 'brain' },
  { value: 'decision', label: '결정', icon: <GitBranch className="w-4 h-4" />, description: '내린 결정과 근거', category: 'brain' },
  { value: 'preference', label: '선호', icon: <Heart className="w-4 h-4" />, description: '선호하는 방식', category: 'brain' },
  { value: 'playbook', label: '플레이북', icon: <BookOpen className="w-4 h-4" />, description: '반복 업무 절차', category: 'brain' },
  // Content Types
  { value: 'concept', label: '개념', icon: <Brain className="w-4 h-4" />, description: '정의/용어', category: 'content' },
  { value: 'idea', label: '아이디어', icon: <Lightbulb className="w-4 h-4" />, description: '가설/검증 단위', category: 'content' },
  { value: 'insight', label: '인사이트', icon: <Sparkles className="w-4 h-4" />, description: '발견한 통찰', category: 'content' },
  { value: 'memory', label: '기억', icon: <Zap className="w-4 h-4" />, description: '사건 + 교훈', category: 'content' },
  { value: 'doc', label: '문서', icon: <FileText className="w-4 h-4" />, description: '근거/출처', category: 'content' },
  // Action Types
  { value: 'project', label: '프로젝트', icon: <FolderOpen className="w-4 h-4" />, description: '컨텍스트 허브', category: 'action' },
  { value: 'task', label: '할일', icon: <CheckSquare className="w-4 h-4" />, description: '실행 단위', category: 'action' },
  // Entity Types
  { value: 'person', label: '사람', icon: <User className="w-4 h-4" />, description: '관련 인물', category: 'entity' },
]

// ============================================
// Synapse (Edge) Type Options for UI
// ============================================
const SYNAPSE_TYPE_OPTIONS: { value: EdgeType; label: string; description: string }[] = [
  { value: 'supports', label: '근거', description: '이 노드가 저 노드를 뒷받침' },
  { value: 'causes', label: '원인', description: '이것이 저것을 야기' },
  { value: 'contradicts', label: '충돌', description: '서로 모순되는 관계' },
  { value: 'defines', label: '정의', description: '개념/용어 정의' },
  { value: 'implements', label: '구현', description: 'Decision을 Task로 구현' },
  { value: 'depends_on', label: '의존', description: '선행 조건 의존' },
  { value: 'example_of', label: '예시', description: '개념의 구체적 예시' },
  { value: 'derived_from', label: '파생', description: '상위 규칙에서 파생' },
  { value: 'reinforced_by', label: '강화', description: '경험으로 강화됨' },
  { value: 'supersedes', label: '대체', description: '이전 결정을 대체' },
  { value: 'related', label: '관련', description: '일반적 연관' },
]

export function NodeEditorModal({ mapId, onClose, editingNode }: NodeEditorModalProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const addNode = useNeuralMapStore((s) => s.addNode)
  const updateNode = useNeuralMapStore((s) => s.updateNode)
  const addEdge = useNeuralMapStore((s) => s.addEdge)
  const graph = useNeuralMapStore((s) => s.graph)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showRelationshipSearch, setShowRelationshipSearch] = useState(false)
  const [relationshipSearch, setRelationshipSearch] = useState('')

  // ============================================
  // Form State - Core Fields
  // ============================================
  const [type, setType] = useState<NodeType>(editingNode?.type || 'decision')
  const [statement, setStatement] = useState(editingNode?.statement || editingNode?.title || '')
  const [why, setWhy] = useState(editingNode?.why || '')
  const [scope, setScope] = useState<NeuronScope>(editingNode?.scope || 'project')
  const [neuronStatus, setNeuronStatus] = useState<NeuronStatus>(editingNode?.neuronStatus || 'active')
  const [confidence, setConfidence] = useState(editingNode?.confidence || 70)
  const [projectId, setProjectId] = useState(editingNode?.projectId || '')

  // ============================================
  // Form State - Relationships (NEW)
  // ============================================
  const [relationships, setRelationships] = useState<{
    targetId: string
    targetTitle: string
    edgeType: EdgeType
  }[]>([])

  // ============================================
  // Form State - Type-Specific Fields
  // ============================================
  // Rule
  const [enforcement, setEnforcement] = useState<EnforcementLevel>(editingNode?.enforcement || 'should')

  // Preference
  const [preferenceStrength, setPreferenceStrength] = useState(editingNode?.preferenceStrength || 7)

  // Decision
  const [alternatives, setAlternatives] = useState(editingNode?.alternatives?.join('\n') || '')
  const [tradeoffs, setTradeoffs] = useState(editingNode?.tradeoffs || '')
  const [reviewDate, setReviewDate] = useState(editingNode?.reviewDate || '')

  // Playbook
  const [steps, setSteps] = useState(editingNode?.steps?.join('\n') || '')
  const [trigger, setTrigger] = useState(editingNode?.trigger || '')
  const [prerequisites, setPrerequisites] = useState(editingNode?.prerequisites?.join('\n') || '')

  // Concept
  const [aliases, setAliases] = useState(editingNode?.aliases?.join(', ') || '')
  const [examples, setExamples] = useState(editingNode?.examples?.join('\n') || '')

  // Idea
  const [hypothesis, setHypothesis] = useState(editingNode?.hypothesis || '')
  const [impact, setImpact] = useState<'high' | 'medium' | 'low'>(editingNode?.impact || 'medium')

  // Task
  const [taskStatus, setTaskStatus] = useState<'todo' | 'doing' | 'done' | 'blocked'>(editingNode?.taskStatus || 'todo')
  const [definitionOfDone, setDefinitionOfDone] = useState(editingNode?.definitionOfDone?.join('\n') || '')

  // Memory
  const [occurredAt, setOccurredAt] = useState(editingNode?.occurredAt || '')
  const [lesson, setLesson] = useState(editingNode?.lesson || '')

  // Identity
  const [identityCategory, setIdentityCategory] = useState<'value' | 'taboo' | 'quality'>(editingNode?.identityCategory || 'value')

  // Insight
  const [actionHint, setActionHint] = useState(editingNode?.actionHint || '')
  const [impactScore, setImpactScore] = useState(editingNode?.impactScore || 50)

  // ============================================
  // Form State - Legacy Fields (Advanced)
  // ============================================
  const [tags, setTags] = useState(editingNode?.tags?.join(', ') || '')
  const [importance, setImportance] = useState(editingNode?.importance || 5)
  const [parentId, setParentId] = useState(editingNode?.parentId || '')
  const [summary, setSummary] = useState(editingNode?.summary || '')

  const isEditing = !!editingNode

  // 프로젝트 노드 목록 (scope가 project일 때 선택용)
  const projectNodes = useMemo(() =>
    graph?.nodes.filter((n) => n.type === 'project') || [],
    [graph?.nodes]
  )

  // 관계 검색용 노드 목록
  const searchableNodes = useMemo(() => {
    if (!relationshipSearch.trim()) return []
    const query = relationshipSearch.toLowerCase()
    return (graph?.nodes || [])
      .filter((n) =>
        n.id !== editingNode?.id &&
        (n.title.toLowerCase().includes(query) ||
         n.statement?.toLowerCase().includes(query))
      )
      .slice(0, 10)
  }, [graph?.nodes, relationshipSearch, editingNode?.id])

  // 관계 추가
  const addRelationship = (node: NeuralNode, edgeType: EdgeType) => {
    if (relationships.some(r => r.targetId === node.id)) return
    setRelationships([...relationships, {
      targetId: node.id,
      targetTitle: node.statement || node.title,
      edgeType,
    }])
    setRelationshipSearch('')
    setShowRelationshipSearch(false)
  }

  // 관계 제거
  const removeRelationship = (targetId: string) => {
    setRelationships(relationships.filter(r => r.targetId !== targetId))
  }

  const handleSubmit = async () => {
    if (!mapId || !statement.trim()) return

    setIsSubmitting(true)
    try {
      const nodeData: Partial<NeuralNode> = {
        type,
        title: statement.trim(), // 호환성을 위해 title도 유지
        statement: statement.trim(),
        why: why.trim() || undefined,
        scope,
        neuronStatus,
        confidence,
        projectId: scope === 'project' ? projectId : undefined,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        importance,
        parentId: parentId || undefined,
        summary: summary.trim() || undefined,
        // Type-specific fields
        ...(type === 'rule' && { enforcement }),
        ...(type === 'preference' && { preferenceStrength }),
        ...(type === 'decision' && {
          alternatives: alternatives.split('\n').filter(Boolean),
          tradeoffs: tradeoffs.trim() || undefined,
          reviewDate: reviewDate || undefined,
        }),
        ...(type === 'playbook' && {
          steps: steps.split('\n').filter(Boolean),
          trigger: trigger.trim() || undefined,
          prerequisites: prerequisites.split('\n').filter(Boolean),
        }),
        ...(type === 'concept' && {
          aliases: aliases.split(',').map(a => a.trim()).filter(Boolean),
          examples: examples.split('\n').filter(Boolean),
        }),
        ...(type === 'idea' && {
          hypothesis: hypothesis.trim() || undefined,
          impact,
        }),
        ...(type === 'task' && {
          taskStatus,
          definitionOfDone: definitionOfDone.split('\n').filter(Boolean),
        }),
        ...(type === 'memory' && {
          occurredAt: occurredAt || undefined,
          lesson: lesson.trim() || undefined,
        }),
        ...(type === 'identity' && { identityCategory }),
        ...(type === 'insight' && {
          actionHint: actionHint.trim() || undefined,
          impactScore,
        }),
      }

      let savedNodeId: string

      if (isEditing && editingNode) {
        // 노드 수정
        const res = await fetch(`/api/neural-map/${mapId}/nodes`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodeId: editingNode.id, ...nodeData }),
        })

        if (!res.ok) throw new Error('Failed to update node')

        const updatedNode = await res.json()
        updateNode(editingNode.id, updatedNode)
        savedNodeId = editingNode.id
      } else {
        // 새 노드 생성
        const res = await fetch(`/api/neural-map/${mapId}/nodes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nodeData),
        })

        if (!res.ok) throw new Error('Failed to create node')

        const newNode = await res.json()
        addNode(newNode)
        savedNodeId = newNode.id
      }

      // 관계(시냅스) 저장
      for (const rel of relationships) {
        const edgeData: Partial<NeuralEdge> = {
          source: savedNodeId,
          target: rel.targetId,
          type: rel.edgeType,
          weight: 0.7,
          bidirectional: false,
        }

        // TODO: API 호출로 엣지 저장
        // 임시로 로컬 스토어에만 추가
        addEdge({
          id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          source: savedNodeId,
          target: rel.targetId,
          type: rel.edgeType,
          weight: 0.7,
          bidirectional: false,
          createdAt: new Date().toISOString(),
        })
      }

      onClose()
    } catch (err) {
      console.error('Node save error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ============================================
  // Render Type-Specific Fields
  // ============================================
  const renderTypeSpecificFields = () => {
    switch (type) {
      case 'rule':
        return (
          <div>
            <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
              강제성 수준
            </label>
            <div className="flex gap-2">
              {(['must', 'should', 'may'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setEnforcement(level)}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                    enforcement === level
                      ? level === 'must'
                        ? 'bg-red-500/20 text-red-400 border-2 border-red-500'
                        : level === 'should'
                        ? 'bg-yellow-500/20 text-yellow-400 border-2 border-yellow-500'
                        : 'bg-green-500/20 text-green-400 border-2 border-green-500'
                      : isDark
                      ? 'bg-zinc-800 text-zinc-400 border-2 border-zinc-700'
                      : 'bg-zinc-100 text-zinc-600 border-2 border-zinc-200'
                  )}
                >
                  {level === 'must' ? '필수' : level === 'should' ? '권장' : '선택'}
                </button>
              ))}
            </div>
          </div>
        )

      case 'preference':
        return (
          <div>
            <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
              선호 강도: {preferenceStrength}/10
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={preferenceStrength}
              onChange={(e) => setPreferenceStrength(Number(e.target.value))}
              className="w-full accent-pink-500"
            />
          </div>
        )

      case 'decision':
        return (
          <div className="space-y-4">
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                검토한 대안들 (줄바꿈으로 구분)
              </label>
              <textarea
                value={alternatives}
                onChange={(e) => setAlternatives(e.target.value)}
                placeholder="대안 A&#10;대안 B&#10;대안 C"
                rows={3}
                className={cn(
                  'no-focus-ring w-full px-3 py-2 rounded-lg border outline-none transition-colors resize-none text-sm',
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                    : 'bg-white border-zinc-200 text-zinc-900'
                )}
              />
            </div>
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                트레이드오프
              </label>
              <input
                type="text"
                value={tradeoffs}
                onChange={(e) => setTradeoffs(e.target.value)}
                placeholder="속도 vs 품질, 비용 vs 기능"
                className={cn(
                  'no-focus-ring w-full px-3 py-2 rounded-lg border outline-none transition-colors text-sm',
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                    : 'bg-white border-zinc-200 text-zinc-900'
                )}
              />
            </div>
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                재검토 예정일
              </label>
              <input
                type="date"
                value={reviewDate}
                onChange={(e) => setReviewDate(e.target.value)}
                className={cn(
                  'no-focus-ring w-full px-3 py-2 rounded-lg border outline-none transition-colors text-sm',
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                    : 'bg-white border-zinc-200 text-zinc-900'
                )}
              />
            </div>
          </div>
        )

      case 'playbook':
        return (
          <div className="space-y-4">
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                실행 단계 (줄바꿈으로 구분)
              </label>
              <textarea
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                placeholder="1. 첫 번째 단계&#10;2. 두 번째 단계&#10;3. 세 번째 단계"
                rows={4}
                className={cn(
                  'no-focus-ring w-full px-3 py-2 rounded-lg border outline-none transition-colors resize-none text-sm',
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                    : 'bg-white border-zinc-200 text-zinc-900'
                )}
              />
            </div>
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                트리거 조건
              </label>
              <input
                type="text"
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                placeholder="언제 이 절차를 실행하나요?"
                className={cn(
                  'no-focus-ring w-full px-3 py-2 rounded-lg border outline-none transition-colors text-sm',
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                    : 'bg-white border-zinc-200 text-zinc-900'
                )}
              />
            </div>
          </div>
        )

      case 'concept':
        return (
          <div className="space-y-4">
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                동의어/별칭 (쉼표로 구분)
              </label>
              <input
                type="text"
                value={aliases}
                onChange={(e) => setAliases(e.target.value)}
                placeholder="별칭1, 별칭2, 영문명"
                className={cn(
                  'no-focus-ring w-full px-3 py-2 rounded-lg border outline-none transition-colors text-sm',
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                    : 'bg-white border-zinc-200 text-zinc-900'
                )}
              />
            </div>
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                예시 (줄바꿈으로 구분)
              </label>
              <textarea
                value={examples}
                onChange={(e) => setExamples(e.target.value)}
                placeholder="예시 1&#10;예시 2"
                rows={2}
                className={cn(
                  'no-focus-ring w-full px-3 py-2 rounded-lg border outline-none transition-colors resize-none text-sm',
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                    : 'bg-white border-zinc-200 text-zinc-900'
                )}
              />
            </div>
          </div>
        )

      case 'idea':
        return (
          <div className="space-y-4">
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                가설 (왜 먹힐까?)
              </label>
              <textarea
                value={hypothesis}
                onChange={(e) => setHypothesis(e.target.value)}
                placeholder="이 아이디어가 효과적인 이유..."
                rows={2}
                className={cn(
                  'no-focus-ring w-full px-3 py-2 rounded-lg border outline-none transition-colors resize-none text-sm',
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                    : 'bg-white border-zinc-200 text-zinc-900'
                )}
              />
            </div>
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                영향도
              </label>
              <div className="flex gap-2">
                {(['high', 'medium', 'low'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setImpact(level)}
                    className={cn(
                      'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                      impact === level
                        ? level === 'high'
                          ? 'bg-red-500/20 text-red-400 border-2 border-red-500'
                          : level === 'medium'
                          ? 'bg-yellow-500/20 text-yellow-400 border-2 border-yellow-500'
                          : 'bg-green-500/20 text-green-400 border-2 border-green-500'
                        : isDark
                        ? 'bg-zinc-800 text-zinc-400 border-2 border-zinc-700'
                        : 'bg-zinc-100 text-zinc-600 border-2 border-zinc-200'
                    )}
                  >
                    {level === 'high' ? '높음' : level === 'medium' ? '중간' : '낮음'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )

      case 'task':
        return (
          <div className="space-y-4">
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                작업 상태
              </label>
              <div className="flex gap-2">
                {(['todo', 'doing', 'done', 'blocked'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setTaskStatus(status)}
                    className={cn(
                      'flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-all',
                      taskStatus === status
                        ? status === 'done'
                          ? 'bg-green-500/20 text-green-400 border-2 border-green-500'
                          : status === 'doing'
                          ? 'bg-blue-500/20 text-blue-400 border-2 border-blue-500'
                          : status === 'blocked'
                          ? 'bg-red-500/20 text-red-400 border-2 border-red-500'
                          : 'bg-zinc-500/20 text-zinc-400 border-2 border-zinc-500'
                        : isDark
                        ? 'bg-zinc-800 text-zinc-400 border-2 border-zinc-700'
                        : 'bg-zinc-100 text-zinc-600 border-2 border-zinc-200'
                    )}
                  >
                    {status === 'todo' ? '할일' : status === 'doing' ? '진행중' : status === 'done' ? '완료' : '블록'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                완료 조건 (DoD)
              </label>
              <textarea
                value={definitionOfDone}
                onChange={(e) => setDefinitionOfDone(e.target.value)}
                placeholder="☐ 조건 1&#10;☐ 조건 2&#10;☐ 조건 3"
                rows={3}
                className={cn(
                  'no-focus-ring w-full px-3 py-2 rounded-lg border outline-none transition-colors resize-none text-sm',
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                    : 'bg-white border-zinc-200 text-zinc-900'
                )}
              />
            </div>
          </div>
        )

      case 'memory':
        return (
          <div className="space-y-4">
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                발생 시점
              </label>
              <input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className={cn(
                  'no-focus-ring w-full px-3 py-2 rounded-lg border outline-none transition-colors text-sm',
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                    : 'bg-white border-zinc-200 text-zinc-900'
                )}
              />
            </div>
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                교훈
              </label>
              <textarea
                value={lesson}
                onChange={(e) => setLesson(e.target.value)}
                placeholder="이 경험에서 배운 것..."
                rows={2}
                className={cn(
                  'no-focus-ring w-full px-3 py-2 rounded-lg border outline-none transition-colors resize-none text-sm',
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                    : 'bg-white border-zinc-200 text-zinc-900'
                )}
              />
            </div>
          </div>
        )

      case 'identity':
        return (
          <div>
            <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
              카테고리
            </label>
            <div className="flex gap-2">
              {(['value', 'taboo', 'quality'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setIdentityCategory(cat)}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                    identityCategory === cat
                      ? cat === 'value'
                        ? 'bg-blue-500/20 text-blue-400 border-2 border-blue-500'
                        : cat === 'taboo'
                        ? 'bg-red-500/20 text-red-400 border-2 border-red-500'
                        : 'bg-purple-500/20 text-purple-400 border-2 border-purple-500'
                      : isDark
                      ? 'bg-zinc-800 text-zinc-400 border-2 border-zinc-700'
                      : 'bg-zinc-100 text-zinc-600 border-2 border-zinc-200'
                  )}
                >
                  {cat === 'value' ? '가치' : cat === 'taboo' ? '금기' : '품질'}
                </button>
              ))}
            </div>
          </div>
        )

      case 'insight':
        return (
          <div className="space-y-4">
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                권고 사항 (그래서 뭘 해야 하나?)
              </label>
              <input
                type="text"
                value={actionHint}
                onChange={(e) => setActionHint(e.target.value)}
                placeholder="이 인사이트 기반으로..."
                className={cn(
                  'no-focus-ring w-full px-3 py-2 rounded-lg border outline-none transition-colors text-sm',
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                    : 'bg-white border-zinc-200 text-zinc-900'
                )}
              />
            </div>
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                영향도 점수: {impactScore}
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={impactScore}
                onChange={(e) => setImpactScore(Number(e.target.value))}
                className="w-full accent-purple-500"
              />
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', duration: 0.3 }}
          className={cn(
            'w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col',
            isDark ? 'bg-zinc-900' : 'bg-white'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className={cn(
              'flex items-center justify-between px-5 py-4 border-b shrink-0',
              isDark ? 'border-zinc-800' : 'border-zinc-200'
            )}
          >
            <div>
              <h2 className={cn('text-lg font-semibold', isDark ? 'text-zinc-100' : 'text-zinc-900')}>
                {isEditing ? '뉴런 편집' : '새 뉴런 추가'}
              </h2>
              <p className={cn('text-xs mt-0.5', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                뇌의 기본 단위를 정의합니다
              </p>
            </div>
            <button
              onClick={onClose}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'
              )}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-5 overflow-y-auto flex-1">
            {/* Node Type Selection */}
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                뉴런 타입
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {NODE_TYPE_OPTIONS.filter(o => o.category === 'brain').map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setType(option.value)}
                    title={option.description}
                    className={cn(
                      'flex flex-col items-center gap-1 p-2 rounded-lg border transition-all',
                      type === option.value
                        ? 'border-[color:var(--accent-color)] bg-[rgba(var(--accent-color-rgb),0.1)]'
                        : isDark
                        ? 'border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/50'
                        : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                    )}
                  >
                    <div className={cn(
                      'transition-colors',
                      type === option.value
                        ? 'text-[color:var(--accent-color)]'
                        : isDark ? 'text-zinc-400' : 'text-zinc-500'
                    )}>{option.icon}</div>
                    <span className={cn(
                      'text-[10px] font-medium transition-colors',
                      type === option.value
                        ? 'text-[color:var(--accent-color)]'
                        : isDark ? 'text-zinc-400' : 'text-zinc-600'
                    )}>
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-1.5 mt-1.5">
                {NODE_TYPE_OPTIONS.filter(o => o.category !== 'brain').slice(0, 5).map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setType(option.value)}
                    title={option.description}
                    className={cn(
                      'flex flex-col items-center gap-1 p-2 rounded-lg border transition-all',
                      type === option.value
                        ? 'border-[color:var(--accent-color)] bg-[rgba(var(--accent-color-rgb),0.1)]'
                        : isDark
                        ? 'border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/50'
                        : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                    )}
                  >
                    <div className={cn(
                      'transition-colors',
                      type === option.value
                        ? 'text-[color:var(--accent-color)]'
                        : isDark ? 'text-zinc-400' : 'text-zinc-500'
                    )}>{option.icon}</div>
                    <span className={cn(
                      'text-[10px] font-medium transition-colors',
                      type === option.value
                        ? 'text-[color:var(--accent-color)]'
                        : isDark ? 'text-zinc-400' : 'text-zinc-600'
                    )}>
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Statement (Core - Required) */}
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                핵심 문장 <span className="text-red-500">*</span>
                <span className={cn('ml-2 text-xs font-normal', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                  1줄로 본질을 표현
                </span>
              </label>
              <input
                type="text"
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                placeholder={
                  type === 'rule' ? 'any 타입 사용을 금지한다' :
                  type === 'decision' ? 'Tailwind CSS를 사용하기로 결정했다' :
                  type === 'playbook' ? '새 컴포넌트 생성 절차' :
                  '핵심 문장을 입력하세요'
                }
                className={cn(
                  'no-focus-ring w-full px-3 py-2.5 rounded-lg border-2 outline-none transition-colors text-sm font-medium',
                  isDark
                    ? 'bg-zinc-800 border-zinc-600 text-zinc-100 focus:border-blue-500'
                    : 'bg-white border-zinc-300 text-zinc-900 focus:border-blue-500'
                )}
              />
            </div>

            {/* Why (Core - Recommended) */}
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                왜? (근거/이유)
              </label>
              <textarea
                value={why}
                onChange={(e) => setWhy(e.target.value)}
                placeholder="이 뉴런이 중요한 이유..."
                rows={2}
                className={cn(
                  'no-focus-ring w-full px-3 py-2 rounded-lg border outline-none transition-colors resize-none text-sm',
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                    : 'bg-white border-zinc-200 text-zinc-900'
                )}
              />
            </div>

            {/* Scope / Status / Confidence (Core - Required) */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={cn('block text-xs font-medium mb-1.5', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                  스코프
                </label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as NeuronScope)}
                  className={cn(
                    'no-focus-ring w-full px-2 py-1.5 rounded-lg border outline-none transition-colors text-sm',
                    isDark
                      ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                      : 'bg-white border-zinc-200 text-zinc-900'
                  )}
                >
                  <option value="global">전역</option>
                  <option value="project">프로젝트</option>
                  <option value="role">역할</option>
                  <option value="task">작업</option>
                </select>
              </div>
              <div>
                <label className={cn('block text-xs font-medium mb-1.5', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                  상태
                </label>
                <select
                  value={neuronStatus}
                  onChange={(e) => setNeuronStatus(e.target.value as NeuronStatus)}
                  className={cn(
                    'no-focus-ring w-full px-2 py-1.5 rounded-lg border outline-none transition-colors text-sm',
                    isDark
                      ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                      : 'bg-white border-zinc-200 text-zinc-900'
                  )}
                >
                  <option value="active">활성</option>
                  <option value="draft">초안</option>
                  <option value="deprecated">폐기</option>
                </select>
              </div>
              <div>
                <label className={cn('block text-xs font-medium mb-1.5', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                  확신도: {confidence}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={confidence}
                  onChange={(e) => setConfidence(Number(e.target.value))}
                  className="w-full accent-blue-500 mt-1"
                />
              </div>
            </div>

            {/* Project Selection (when scope is project) */}
            {scope === 'project' && projectNodes.length > 0 && (
              <div>
                <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                  연결할 프로젝트
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className={cn(
                    'no-focus-ring w-full px-3 py-2 rounded-lg border outline-none transition-colors text-sm',
                    isDark
                      ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                      : 'bg-white border-zinc-200 text-zinc-900'
                  )}
                >
                  <option value="">프로젝트 선택...</option>
                  {projectNodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Type-Specific Fields */}
            {renderTypeSpecificFields()}

            {/* Relationships (Synapses) */}
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                <Link className="w-4 h-4 inline-block mr-1" />
                관계 (시냅스)
                <span className={cn('ml-2 text-xs font-normal', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                  연결이 뇌를 만듭니다
                </span>
              </label>

              {/* Added Relationships */}
              {relationships.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {relationships.map((rel) => (
                    <div
                      key={rel.targetId}
                      className={cn(
                        'flex items-center justify-between px-3 py-2 rounded-lg text-sm',
                        isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'px-1.5 py-0.5 rounded text-xs font-medium',
                          isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
                        )}>
                          {SYNAPSE_TYPE_OPTIONS.find(s => s.value === rel.edgeType)?.label || rel.edgeType}
                        </span>
                        <span className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>
                          {rel.targetTitle}
                        </span>
                      </div>
                      <button
                        onClick={() => removeRelationship(rel.targetId)}
                        className={cn(
                          'p-1 rounded hover:bg-red-500/20 text-red-400',
                          isDark ? 'hover:bg-red-500/20' : 'hover:bg-red-100'
                        )}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Relationship */}
              {showRelationshipSearch ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className={cn(
                        'absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4',
                        isDark ? 'text-zinc-500' : 'text-zinc-400'
                      )} />
                      <input
                        type="text"
                        value={relationshipSearch}
                        onChange={(e) => setRelationshipSearch(e.target.value)}
                        placeholder="노드 검색..."
                        autoFocus
                        className={cn(
                          'no-focus-ring w-full pl-8 pr-3 py-2 rounded-lg border outline-none transition-colors text-sm',
                          isDark
                            ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                            : 'bg-white border-zinc-200 text-zinc-900'
                        )}
                      />
                    </div>
                    <button
                      onClick={() => {
                        setShowRelationshipSearch(false)
                        setRelationshipSearch('')
                      }}
                      className={cn(
                        'px-3 py-2 rounded-lg text-sm',
                        isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-600'
                      )}
                    >
                      취소
                    </button>
                  </div>

                  {/* Search Results */}
                  {searchableNodes.length > 0 && (
                    <div className={cn(
                      'rounded-lg border overflow-hidden',
                      isDark ? 'border-zinc-700' : 'border-zinc-200'
                    )}>
                      {searchableNodes.map((node) => (
                        <div
                          key={node.id}
                          className={cn(
                            'p-2 border-b last:border-b-0',
                            isDark ? 'border-zinc-700' : 'border-zinc-200'
                          )}
                        >
                          <div className={cn('text-sm font-medium mb-1', isDark ? 'text-zinc-200' : 'text-zinc-800')}>
                            {node.statement || node.title}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {SYNAPSE_TYPE_OPTIONS.slice(0, 6).map((syn) => (
                              <button
                                key={syn.value}
                                onClick={() => addRelationship(node, syn.value)}
                                className={cn(
                                  'px-2 py-0.5 rounded text-xs transition-colors',
                                  isDark
                                    ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
                                    : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-700'
                                )}
                              >
                                {syn.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowRelationshipSearch(true)}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed transition-colors text-sm',
                    isDark
                      ? 'border-zinc-700 hover:border-zinc-600 text-zinc-400 hover:text-zinc-300'
                      : 'border-zinc-300 hover:border-zinc-400 text-zinc-500 hover:text-zinc-600'
                  )}
                >
                  <Plus className="w-4 h-4" />
                  관계 추가
                </button>
              )}
            </div>

            {/* Advanced Section (Collapsed) */}
            <div>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={cn(
                  'flex items-center gap-2 text-sm font-medium transition-colors',
                  isDark ? 'text-zinc-400 hover:text-zinc-300' : 'text-zinc-500 hover:text-zinc-600'
                )}
              >
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                고급 설정
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-4 p-3 rounded-lg border border-dashed border-zinc-600">
                  {/* Tags */}
                  <div>
                    <label className={cn('block text-xs font-medium mb-1.5', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                      태그 (쉼표 구분)
                    </label>
                    <input
                      type="text"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      placeholder="태그1, 태그2"
                      className={cn(
                        'no-focus-ring w-full px-3 py-1.5 rounded-lg border outline-none transition-colors text-sm',
                        isDark
                          ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                          : 'bg-white border-zinc-200 text-zinc-900'
                      )}
                    />
                  </div>

                  {/* Parent Node */}
                  <div>
                    <label className={cn('block text-xs font-medium mb-1.5', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                      상위 노드
                    </label>
                    <select
                      value={parentId}
                      onChange={(e) => setParentId(e.target.value)}
                      className={cn(
                        'no-focus-ring w-full px-3 py-1.5 rounded-lg border outline-none transition-colors text-sm',
                        isDark
                          ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                          : 'bg-white border-zinc-200 text-zinc-900'
                      )}
                    >
                      <option value="">없음</option>
                      {(graph?.nodes || []).filter(n => n.id !== editingNode?.id).map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Summary (Legacy) */}
                  <div>
                    <label className={cn('block text-xs font-medium mb-1.5', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                      설명 (선택)
                    </label>
                    <textarea
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      placeholder="추가 설명..."
                      rows={2}
                      className={cn(
                        'no-focus-ring w-full px-3 py-1.5 rounded-lg border outline-none transition-colors resize-none text-sm',
                        isDark
                          ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                          : 'bg-white border-zinc-200 text-zinc-900'
                      )}
                    />
                  </div>

                  {/* Importance */}
                  <div>
                    <label className={cn('block text-xs font-medium mb-1.5', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                      중요도: {importance}
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={importance}
                      onChange={(e) => setImportance(Number(e.target.value))}
                      className="w-full accent-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div
            className={cn(
              'flex items-center justify-end gap-3 px-5 py-4 border-t shrink-0',
              isDark ? 'border-zinc-800' : 'border-zinc-200'
            )}
          >
            <button
              onClick={onClose}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                isDark
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
              )}
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={!statement.trim() || isSubmitting}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                'bg-blue-600 hover:bg-blue-500 text-white',
                (!statement.trim() || isSubmitting) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditing ? '저장' : '추가'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
