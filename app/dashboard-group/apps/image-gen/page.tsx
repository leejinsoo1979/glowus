'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Download,
  Copy,
  RefreshCw,
  ImageIcon,
  Wand2,
  Settings2,
  Check,
  AlertCircle
} from 'lucide-react'
import { useAIAppSync } from "@/hooks/useAIAppSync"

interface GeneratedImage {
  url: string
  prompt: string
  width: number
  height: number
  timestamp: number
}

export default function ImageGenPage() {
  const [prompt, setPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [width, setWidth] = useState(1024)
  const [height, setHeight] = useState(1024)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [copied, setCopied] = useState(false)

  // 🔥 DB 동기화 훅
  const { saveMessage: saveToDb, updateThreadTitle, updateThreadMetadata } = useAIAppSync({
    appType: 'image',
    autoCreateThread: true,
  })

  const sizePresets = [
    { label: '1:1', width: 1024, height: 1024 },
    { label: '16:9', width: 1024, height: 576 },
    { label: '9:16', width: 576, height: 1024 },
    { label: '4:3', width: 1024, height: 768 },
    { label: '3:4', width: 768, height: 1024 },
  ]

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('프롬프트를 입력해주세요')
      return
    }

    setIsGenerating(true)
    setError(null)

    // 🔥 사용자 프롬프트 DB에 저장
    saveToDb({ role: 'user', content: prompt.trim() })

    try {
      const response = await fetch('/api/skills/z-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          negative_prompt: negativePrompt.trim() || undefined,
          width,
          height,
        }),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || '이미지 생성 실패')
      }

      const newImage = {
        url: result.image_url,
        prompt: prompt.trim(),
        width,
        height,
        timestamp: Date.now(),
      }

      setGeneratedImages(prev => [newImage, ...prev])

      // 🔥 생성 완료 메시지 DB에 저장
      saveToDb({ role: 'assistant', content: `이미지가 생성되었습니다: ${prompt.trim()}`, metadata: { imageUrl: result.image_url, width, height } })
      // 🔥 첫 이미지 생성 시 스레드 제목 설정
      updateThreadTitle(prompt.trim().slice(0, 50))
      updateThreadMetadata({ images: [...generatedImages, newImage].slice(0, 10) }) // 최근 10개만 저장

    } catch (err: any) {
      setError(err.message || '이미지 생성 중 오류가 발생했습니다')
      // 🔥 에러 메시지 DB에 저장
      saveToDb({ role: 'assistant', content: `이미지 생성 실패: ${err.message}` })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = async (imageUrl: string, index: number) => {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `glowus-image-${index + 1}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
              <Sparkles className="w-6 h-6 text-purple-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">이미지 제작</h1>
          </div>
          <p className="text-zinc-400">Z-Image AI로 고품질 이미지를 생성하세요</p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="space-y-4">
            {/* Prompt Input */}
            <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4">
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                프롬프트
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="생성할 이미지를 설명해주세요... (영어로 작성하면 더 좋은 결과)"
                className="w-full h-32 bg-zinc-800/50 rounded-xl border border-zinc-700 p-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 resize-none"
              />
            </div>

            {/* Settings Toggle */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              <Settings2 className="w-4 h-4" />
              고급 설정 {showSettings ? '접기' : '펼치기'}
            </button>

            {/* Advanced Settings */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4 space-y-4">
                    {/* Negative Prompt */}
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">
                        네거티브 프롬프트 (제외할 요소)
                      </label>
                      <input
                        type="text"
                        value={negativePrompt}
                        onChange={(e) => setNegativePrompt(e.target.value)}
                        placeholder="low quality, blurry, distorted..."
                        className="w-full bg-zinc-800/50 rounded-xl border border-zinc-700 p-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      />
                    </div>

                    {/* Size Presets */}
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">
                        비율
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {sizePresets.map((preset) => (
                          <button
                            key={preset.label}
                            onClick={() => {
                              setWidth(preset.width)
                              setHeight(preset.height)
                            }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              width === preset.width && height === preset.height
                                ? 'bg-purple-500 text-white'
                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Size */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">
                          너비
                        </label>
                        <input
                          type="number"
                          value={width}
                          onChange={(e) => setWidth(Number(e.target.value))}
                          min={512}
                          max={2048}
                          step={64}
                          className="w-full bg-zinc-800/50 rounded-xl border border-zinc-700 p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">
                          높이
                        </label>
                        <input
                          type="number"
                          value={height}
                          onChange={(e) => setHeight(Number(e.target.value))}
                          min={512}
                          max={2048}
                          step={64}
                          className="w-full bg-zinc-800/50 rounded-xl border border-zinc-700 p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            {/* Generate Button */}
            <motion.button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full py-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                isGenerating || !prompt.trim()
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600'
              }`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  이미지 생성
                </>
              )}
            </motion.button>
          </div>

          {/* Output Section */}
          <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4 min-h-[400px]">
            {generatedImages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
                <p>생성된 이미지가 여기에 표시됩니다</p>
              </div>
            ) : (
              <div className="space-y-4">
                {generatedImages.map((image, index) => (
                  <motion.div
                    key={image.timestamp}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative group"
                  >
                    <img
                      src={image.url}
                      alt={image.prompt}
                      className="w-full rounded-xl"
                    />

                    {/* Overlay Actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-3">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDownload(image.url, index)}
                        className="p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-sm"
                      >
                        <Download className="w-5 h-5 text-white" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleCopyUrl(image.url)}
                        className="p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-sm"
                      >
                        {copied ? (
                          <Check className="w-5 h-5 text-green-400" />
                        ) : (
                          <Copy className="w-5 h-5 text-white" />
                        )}
                      </motion.button>
                    </div>

                    {/* Prompt Caption */}
                    <div className="mt-2 text-sm text-zinc-400 truncate">
                      {image.prompt}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
