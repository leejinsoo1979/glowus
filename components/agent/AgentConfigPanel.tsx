"use client"

import { Node } from "reactflow"
import { motion, AnimatePresence } from "framer-motion"
import { X, Trash2, Settings, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/Button"
import type { AgentNodeData, AgentType } from "@/lib/agent"

interface AgentConfigPanelProps {
  node: Node<AgentNodeData> | null
  onClose: () => void
  onUpdate: (nodeId: string, data: Partial<AgentNodeData>) => void
}

export function AgentConfigPanel({
  node,
  onClose,
  onUpdate,
}: AgentConfigPanelProps) {
  if (!node) return null

  const handleChange = (key: keyof AgentNodeData, value: unknown) => {
    onUpdate(node.id, { [key]: value })
  }

  const renderConfigFields = () => {
    const type = node.type as AgentType

    switch (type) {
      case "llm":
        return (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">모델</label>
              <select
                value={node.data.model || "gpt-4-turbo"}
                onChange={(e) => handleChange("model", e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              >
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                <option value="claude-3-opus">Claude 3 Opus</option>
                <option value="claude-3-sonnet">Claude 3 Sonnet</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Temperature ({node.data.temperature || 0.7})
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={node.data.temperature || 0.7}
                onChange={(e) =>
                  handleChange("temperature", parseFloat(e.target.value))
                }
                className="w-full accent-violet-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Max Tokens
              </label>
              <input
                type="number"
                value={node.data.maxTokens || 2048}
                onChange={(e) =>
                  handleChange("maxTokens", parseInt(e.target.value))
                }
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                System Prompt
              </label>
              <textarea
                value={node.data.systemPrompt || ""}
                onChange={(e) => handleChange("systemPrompt", e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
                placeholder="시스템 프롬프트를 입력하세요..."
              />
            </div>
          </>
        )

      case "prompt":
        return (
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              프롬프트 내용
            </label>
            <textarea
              value={node.data.prompt || ""}
              onChange={(e) => handleChange("prompt", e.target.value)}
              rows={6}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
              placeholder="프롬프트를 입력하세요..."
            />
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
              $input1, $input2 등을 사용하여 연결된 노드의 출력을 참조하세요
            </p>
          </div>
        )

      case "memory":
        return (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                메모리 타입
              </label>
              <select
                value={node.data.memoryType || "buffer"}
                onChange={(e) => handleChange("memoryType", e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              >
                <option value="buffer">Buffer Memory</option>
                <option value="summary">Summary Memory</option>
                <option value="vector">Vector Memory</option>
                <option value="none">No Memory</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                메모리 한도 (대화 수)
              </label>
              <input
                type="number"
                value={node.data.memoryLimit || 10}
                onChange={(e) =>
                  handleChange("memoryLimit", parseInt(e.target.value))
                }
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
          </>
        )

      case "rag":
        return (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                벡터 스토어
              </label>
              <select
                value={node.data.vectorStore || "supabase"}
                onChange={(e) => handleChange("vectorStore", e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              >
                <option value="supabase">Supabase</option>
                <option value="pinecone">Pinecone</option>
                <option value="weaviate">Weaviate</option>
                <option value="chroma">Chroma</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                임베딩 모델
              </label>
              <select
                value={node.data.embeddingModel || "text-embedding-3-small"}
                onChange={(e) =>
                  handleChange("embeddingModel", e.target.value)
                }
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              >
                <option value="text-embedding-3-small">
                  text-embedding-3-small
                </option>
                <option value="text-embedding-3-large">
                  text-embedding-3-large
                </option>
                <option value="text-embedding-ada-002">
                  text-embedding-ada-002
                </option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                검색 결과 수
              </label>
              <input
                type="number"
                value={node.data.retrievalCount || 5}
                onChange={(e) =>
                  handleChange("retrievalCount", parseInt(e.target.value))
                }
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
          </>
        )

      case "router":
        return (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                라우팅 로직
              </label>
              <select
                value={node.data.routingLogic || "conditional"}
                onChange={(e) => handleChange("routingLogic", e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              >
                <option value="conditional">조건부 분기</option>
                <option value="sequential">순차 실행</option>
                <option value="parallel">병렬 실행</option>
              </select>
            </div>

            {node.data.routingLogic === "conditional" && (
              <div className="space-y-2 mt-4">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  조건 코드 (JavaScript)
                </label>
                <textarea
                  value={node.data.code || "// return 'handle1' or 'handle2' based on input\nif (input.includes('hello')) return 'a';\nreturn 'b';"}
                  onChange={(e) => handleChange("code", e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
                  placeholder="// 조건 로직을 작성하세요"
                />
              </div>
            )}

            <div className="p-3 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg mt-4">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                💡 라우터는 입력에 따라 다른 경로로 대화를 분기합니다.
                조건부 분기 선택 시, 위 코드창에 반환할 핸들 ID('a', 'b' 등)를 결정하는 로직을 작성하세요.
              </p>
            </div>
          </>
        )

      case "evaluator":
        return (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                평가 타입
              </label>
              <select
                value={node.data.evaluationType || "quality"}
                onChange={(e) => handleChange("evaluationType", e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              >
                <option value="quality">품질 평가</option>
                <option value="relevance">관련성 평가</option>
                <option value="accuracy">정확도 평가</option>
                <option value="safety">안전성 평가</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                임계값 ({node.data.threshold || 0.8})
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={node.data.threshold || 0.8}
                onChange={(e) =>
                  handleChange("threshold", parseFloat(e.target.value))
                }
                className="w-full accent-violet-500"
              />
            </div>
          </>
        )

      case "input":
        return (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                입력 타입
              </label>
              <select
                value={node.data.inputType || "text"}
                onChange={(e) => handleChange("inputType", e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              >
                <option value="text">텍스트</option>
                <option value="file">파일</option>
                <option value="api">API</option>
                <option value="webhook">웹훅</option>
                <option value="schedule">스케줄</option>
              </select>
            </div>
          </>
        )

      case "output":
        return (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                출력 타입
              </label>
              <select
                value={node.data.outputType || "text"}
                onChange={(e) => handleChange("outputType", e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              >
                <option value="text">텍스트</option>
                <option value="json">JSON</option>
                <option value="stream">스트림</option>
                <option value="file">파일</option>
              </select>
            </div>
          </>
        )

      case "function":
        return (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                함수 이름
              </label>
              <input
                type="text"
                value={node.data.functionName || ""}
                onChange={(e) => handleChange("functionName", e.target.value)}
                placeholder="함수 이름을 입력하세요"
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                함수 인자 (JSON)
              </label>
              <textarea
                value={node.data.functionArgs || "{}"}
                onChange={(e) => handleChange("functionArgs", e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
                placeholder='{"param1": "value1"}'
              />
            </div>
          </>
        )

      case "javascript":
        return (
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              코드 (JavaScript):
            </label>
            <textarea
              value={node.data.code || "// Access inputs as input1, etc.\nreturn input1.toUpperCase()"}
              onChange={(e) => handleChange("code", e.target.value)}
              rows={12}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
              placeholder="// 여기에 자바스크립트 코드를 작성하세요"
            />
          </div>
        )

      case "custom_tool":
        return (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                도구 이름
              </label>
              <input
                type="text"
                value={node.data.functionName || ""}
                onChange={(e) => handleChange("functionName", e.target.value)}
                placeholder="사용자 정의 도구 이름"
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                구현 (JavaScript)
              </label>
              <textarea
                value={node.data.code || "// Tool implementation\nasync function execute(args) {\n  // Your code here\n  return result;\n}"}
                onChange={(e) => handleChange("code", e.target.value)}
                rows={12}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
                placeholder="// Implementation"
              />
            </div>
          </>
        )

      case "image_generation":
        return (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                모델
              </label>
              <select
                value={node.data.model || "dall-e-3"}
                onChange={(e) => handleChange("model", e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              >
                <option value="dall-e-3">DALL·E 3</option>
                <option value="dall-e-2">DALL·E 2</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                이미지 크기
              </label>
              <select
                value={node.data.inputConfig?.size as string || "1024x1024"}
                onChange={(e) => handleChange("inputConfig", { ...node.data.inputConfig, size: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              >
                <option value="1024x1024">1024x1024</option>
                <option value="512x512">512x512</option>
                <option value="256x256">256x256</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                품질
              </label>
              <select
                value={node.data.inputConfig?.quality as string || "standard"}
                onChange={(e) => handleChange("inputConfig", { ...node.data.inputConfig, quality: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              >
                <option value="standard">Standard</option>
                <option value="hd">HD</option>
              </select>
            </div>
          </>
        )

      case "embedding":
        return (
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              임베딩 모델
            </label>
            <select
              value={node.data.embeddingModel || "text-embedding-3-small"}
              onChange={(e) => handleChange("embeddingModel", e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            >
              <option value="text-embedding-3-small">text-embedding-3-small</option>
              <option value="text-embedding-3-large">text-embedding-3-large</option>
              <option value="text-embedding-ada-002">text-embedding-ada-002</option>
            </select>
          </div>
        )

      case "tool":
        return (
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              API URL
            </label>
            <input
              type="text"
              value={node.data.url || ""}
              onChange={(e) => handleChange("url", e.target.value)}
              placeholder="https://api.example.com/v1/..."
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
          </div>
        )
        return (
          <div className="p-3 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              이 노드에 대한 추가 설정이 없습니다.
            </p>
          </div>
        )
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 300, opacity: 0 }}
        className="w-80 bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden transition-colors duration-200"
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between transition-colors">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">노드 설정</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Node Info */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">노드 이름</label>
            <input
              type="text"
              value={node.data.label || ""}
              onChange={(e) => handleChange("label", e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">설명</label>
            <textarea
              value={node.data.description || ""}
              onChange={(e) => handleChange("description", e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
              placeholder="노드 설명을 입력하세요..."
            />
          </div>

          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 transition-colors">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-violet-500 dark:text-violet-400" />
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-300">
                상세 설정
              </span>
            </div>
            {renderConfigFields()}
          </div>
        </div>

      </motion.div>
    </AnimatePresence>
  )
}
