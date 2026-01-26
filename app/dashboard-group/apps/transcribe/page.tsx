"use client"

import React, { useState, useRef, useCallback } from 'react'
import {
  Mic,
  Upload,
  FileAudio,
  Play,
  Pause,
  Download,
  Copy,
  Check,
  Loader2,
  User,
  Clock,
  AlertCircle,
  X,
  Settings,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

interface TranscriptionSegment {
  speaker: string
  start: number
  end: number
  text: string
}

interface TranscriptionResult {
  raw_text: string
  segments: TranscriptionSegment[]
  srt_content: string
}

export default function TranscribePage() {
  const [file, setFile] = useState<File | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [result, setResult] = useState<TranscriptionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [customTerms, setCustomTerms] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // 파일 선택 핸들러
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setAudioUrl(URL.createObjectURL(selectedFile))
      setResult(null)
      setError(null)
    }
  }, [])

  // 드래그 앤 드롭 핸들러
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.type.startsWith('audio/')) {
      setFile(droppedFile)
      setAudioUrl(URL.createObjectURL(droppedFile))
      setResult(null)
      setError(null)
    }
  }, [])

  // 녹음 시작
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const recordedFile = new File([blob], 'recording.webm', { type: 'audio/webm' })
        setFile(recordedFile)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      setError('마이크 접근 권한이 필요합니다')
    }
  }

  // 녹음 중지
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  // 트랜스크립션 요청
  const handleTranscribe = async () => {
    if (!file) return

    setIsTranscribing(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('audio', file)
      if (customTerms) {
        formData.append('customTerms', customTerms)
      }

      const response = await fetch('/api/asr/transcribe', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '트랜스크립션 실패')
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다')
    } finally {
      setIsTranscribing(false)
    }
  }

  // 텍스트 복사
  const copyText = () => {
    if (result?.raw_text) {
      navigator.clipboard.writeText(result.raw_text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // SRT 다운로드
  const downloadSRT = () => {
    if (result?.srt_content) {
      const blob = new Blob([result.srt_content], { type: 'text/srt' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${file?.name || 'transcription'}.srt`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  // 시간 포맷팅
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // 오디오 재생 컨트롤
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  // 세그먼트 클릭 시 해당 시간으로 이동
  const seekToTime = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  // 파일 초기화
  const clearFile = () => {
    setFile(null)
    setAudioUrl(null)
    setResult(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white">
      <div className="max-w-6xl mx-auto p-6">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">음성 텍스트 변환</h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            VibeVoice-ASR을 활용한 고품질 음성 인식 (한국어, 영어 등 12개 언어 지원)
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 왼쪽: 입력 영역 */}
          <div className="space-y-4">
            {/* 파일 업로드 / 녹음 */}
            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">오디오 입력</h2>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  <Settings className="w-4 h-4" />
                  설정
                  {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* 설정 패널 */}
              {showSettings && (
                <div className="mb-4 p-4 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                  <label className="block text-sm font-medium mb-2">
                    Custom Terms (용어 인식 개선)
                  </label>
                  <textarea
                    value={customTerms}
                    onChange={(e) => setCustomTerms(e.target.value)}
                    placeholder="인식할 특수 용어를 입력하세요 (예: GlowUS, VibeVoice)"
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm resize-none"
                    rows={2}
                  />
                </div>
              )}

              {/* 파일이 없을 때 업로드 영역 */}
              {!file ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-8 text-center hover:border-purple-500 transition-colors"
                >
                  <FileAudio className="w-12 h-12 mx-auto mb-4 text-zinc-400" />
                  <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                    오디오/비디오 파일을 드래그하거나 클릭하여 업로드
                  </p>
                  <p className="text-xs text-zinc-400 mb-4">
                    MP3, WAV, M4A, FLAC, MP4, WebM 등 (최대 50MB)
                  </p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      파일 선택
                    </button>
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        isRecording
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600'
                      }`}
                    >
                      <Mic className={`w-4 h-4 ${isRecording ? 'animate-pulse' : ''}`} />
                      {isRecording ? '녹음 중지' : '녹음'}
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              ) : (
                /* 파일 선택됨 */
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                    <div className="flex items-center gap-3">
                      <FileAudio className="w-8 h-8 text-purple-500" />
                      <div>
                        <p className="font-medium truncate max-w-[200px]">{file.name}</p>
                        <p className="text-xs text-zinc-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={clearFile}
                      className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 오디오 플레이어 */}
                  {audioUrl && (
                    <div className="flex items-center gap-3 p-4 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                      <button
                        onClick={togglePlay}
                        className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-full"
                      >
                        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      </button>
                      <div className="flex-1">
                        <audio
                          ref={audioRef}
                          src={audioUrl}
                          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                          onEnded={() => setIsPlaying(false)}
                          className="hidden"
                        />
                        <div className="h-2 bg-zinc-300 dark:bg-zinc-600 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500"
                            style={{
                              width: audioRef.current
                                ? `${(currentTime / audioRef.current.duration) * 100}%`
                                : '0%',
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-sm text-zinc-500 min-w-[50px]">
                        {formatTime(currentTime)}
                      </span>
                    </div>
                  )}

                  {/* 변환 버튼 */}
                  <button
                    onClick={handleTranscribe}
                    disabled={isTranscribing}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    {isTranscribing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        변환 중...
                      </>
                    ) : (
                      '텍스트 변환 시작'
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}
          </div>

          {/* 오른쪽: 결과 영역 */}
          <div className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 min-h-[400px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">변환 결과</h2>
              {result && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyText}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? '복사됨' : '복사'}
                  </button>
                  <button
                    onClick={downloadSRT}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    SRT
                  </button>
                </div>
              )}
            </div>

            {isTranscribing ? (
              <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                <Loader2 className="w-10 h-10 animate-spin mb-4" />
                <p>음성을 텍스트로 변환하는 중...</p>
                <p className="text-sm mt-2">화자 분리 및 타임스탬프 생성 중</p>
              </div>
            ) : result ? (
              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                {result.segments.length > 0 ? (
                  result.segments.map((segment, index) => (
                    <div
                      key={index}
                      onClick={() => seekToTime(segment.start)}
                      className="p-3 bg-white dark:bg-zinc-800 rounded-xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded text-xs font-medium">
                          <User className="w-3 h-3" />
                          {segment.speaker}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-zinc-500">
                          <Clock className="w-3 h-3" />
                          {formatTime(segment.start)} - {formatTime(segment.end)}
                        </div>
                      </div>
                      <p className="text-sm">{segment.text}</p>
                    </div>
                  ))
                ) : (
                  <div className="p-4 bg-white dark:bg-zinc-800 rounded-xl">
                    <p className="whitespace-pre-wrap">{result.raw_text}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-zinc-400">
                <FileAudio className="w-12 h-12 mb-4 opacity-50" />
                <p>오디오 파일을 업로드하면</p>
                <p>여기에 변환 결과가 표시됩니다</p>
              </div>
            )}
          </div>
        </div>

        {/* 지원 정보 */}
        <div className="mt-8 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <h3 className="font-medium mb-2">지원 언어 및 기능</h3>
          <div className="flex flex-wrap gap-2 text-sm">
            {['한국어', '영어', '중국어', '일본어', '스페인어', '프랑스어', '독일어', '러시아어', '태국어', '베트남어', '이탈리아어', '포르투갈어'].map((lang) => (
              <span
                key={lang}
                className="px-2 py-1 bg-zinc-200 dark:bg-zinc-800 rounded"
              >
                {lang}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-sm text-zinc-500">
            <span>화자 분리 지원</span>
            <span>60분 긴 오디오 지원</span>
            <span>SRT 자막 다운로드</span>
            <span>단어별 타임스탬프</span>
          </div>
        </div>
      </div>
    </div>
  )
}
