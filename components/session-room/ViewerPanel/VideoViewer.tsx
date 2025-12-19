'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTheme } from 'next-themes'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  SkipBack,
  SkipForward,
  Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface VideoViewerProps {
  url: string
  currentTime: number
  onTimeChange: (time: number) => void
}

export function VideoViewer({
  url,
  currentTime,
  onTimeChange
}: VideoViewerProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const videoRef = useRef<HTMLVideoElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [duration, setDuration] = useState(0)
  const [localTime, setLocalTime] = useState(currentTime)
  const [buffered, setBuffered] = useState(0)
  const [showControls, setShowControls] = useState(true)
  const [playbackRate, setPlaybackRate] = useState(1)

  // Format time to MM:SS or HH:MM:SS
  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Sync external time changes
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 1) {
      videoRef.current.currentTime = currentTime
      setLocalTime(currentTime)
    }
  }, [currentTime])

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
    }

    const handleTimeUpdate = () => {
      setLocalTime(video.currentTime)
      // Update buffered
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1))
      }
    }

    const handleEnded = () => {
      setIsPlaying(false)
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('ended', handleEnded)
    }
  }, [])

  const togglePlay = () => {
    if (!videoRef.current) return

    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const toggleMute = () => {
    if (!videoRef.current) return
    videoRef.current.muted = !isMuted
    setIsMuted(!isMuted)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
      setIsMuted(newVolume === 0)
    }
  }

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !videoRef.current) return

    const rect = progressRef.current.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    const newTime = percent * duration

    videoRef.current.currentTime = newTime
    setLocalTime(newTime)
    onTimeChange(newTime)
  }, [duration, onTimeChange])

  const skip = (seconds: number) => {
    if (!videoRef.current) return
    const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds))
    videoRef.current.currentTime = newTime
    setLocalTime(newTime)
    onTimeChange(newTime)
  }

  const handlePlaybackRateChange = () => {
    const rates = [0.5, 0.75, 1, 1.25, 1.5, 2]
    const currentIndex = rates.indexOf(playbackRate)
    const nextIndex = (currentIndex + 1) % rates.length
    const newRate = rates[nextIndex]

    setPlaybackRate(newRate)
    if (videoRef.current) {
      videoRef.current.playbackRate = newRate
    }
  }

  const toggleFullscreen = () => {
    if (!videoRef.current) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      videoRef.current.requestFullscreen()
    }
  }

  // Detect YouTube URL
  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be')

  if (isYouTube) {
    // Extract video ID
    let videoId = ''
    if (url.includes('youtube.com/watch')) {
      videoId = new URL(url).searchParams.get('v') || ''
    } else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1]?.split('?')[0] || ''
    }

    return (
      <div className={cn(
        'h-full flex flex-col',
        isDark ? 'bg-neutral-900' : 'bg-neutral-50'
      )}>
        <div className="flex-1 relative">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?start=${Math.floor(currentTime)}&enablejsapi=1`}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        {/* Timestamp Input */}
        <div className={cn(
          'flex-shrink-0 flex items-center gap-3 px-3 py-2 border-t',
          isDark ? 'border-neutral-800' : 'border-neutral-200'
        )}>
          <span className={cn(
            'text-xs',
            isDark ? 'text-neutral-400' : 'text-neutral-600'
          )}>
            타임스탬프 (초):
          </span>
          <input
            type="number"
            value={Math.floor(currentTime)}
            onChange={(e) => onTimeChange(parseInt(e.target.value) || 0)}
            className={cn(
              'w-20 px-2 py-1 rounded text-xs',
              isDark
                ? 'bg-neutral-800 text-neutral-200 border-neutral-700'
                : 'bg-white text-neutral-900 border-neutral-300',
              'border focus:outline-none focus:ring-1 focus:ring-neutral-500'
            )}
            min={0}
          />
          <span className={cn(
            'text-xs',
            isDark ? 'text-neutral-500' : 'text-neutral-400'
          )}>
            {formatTime(currentTime)}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'h-full flex flex-col',
        isDark ? 'bg-neutral-950' : 'bg-neutral-900'
      )}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Video */}
      <div className="flex-1 relative flex items-center justify-center">
        <video
          ref={videoRef}
          src={url}
          className="max-w-full max-h-full"
          onClick={togglePlay}
        />

        {/* Play/Pause Overlay */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/20"
          >
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Play className="w-8 h-8 text-white ml-1" />
            </div>
          </button>
        )}
      </div>

      {/* Controls */}
      <div className={cn(
        'flex-shrink-0 transition-opacity',
        showControls ? 'opacity-100' : 'opacity-0'
      )}>
        {/* Progress Bar */}
        <div
          ref={progressRef}
          onClick={handleSeek}
          className="h-1 bg-neutral-800 cursor-pointer group"
        >
          {/* Buffered */}
          <div
            className="absolute h-1 bg-neutral-600"
            style={{ width: `${(buffered / duration) * 100}%` }}
          />
          {/* Progress */}
          <div
            className="absolute h-1 bg-white group-hover:bg-neutral-200 transition-colors"
            style={{ width: `${(localTime / duration) * 100}%` }}
          />
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${(localTime / duration) * 100}% - 6px)` }}
          />
        </div>

        {/* Control Buttons */}
        <div className="flex items-center gap-2 px-3 py-2 bg-neutral-900">
          <button onClick={togglePlay} className="p-1 text-white hover:text-neutral-300">
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>

          <button onClick={() => skip(-10)} className="p-1 text-neutral-400 hover:text-white">
            <SkipBack className="w-4 h-4" />
          </button>

          <button onClick={() => skip(10)} className="p-1 text-neutral-400 hover:text-white">
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Time */}
          <span className="text-xs text-neutral-400 mx-2">
            {formatTime(localTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {/* Playback Rate */}
          <button
            onClick={handlePlaybackRateChange}
            className="px-1.5 py-0.5 text-xs text-neutral-400 hover:text-white"
          >
            {playbackRate}x
          </button>

          {/* Volume */}
          <div className="flex items-center gap-1 group">
            <button onClick={toggleMute} className="p-1 text-neutral-400 hover:text-white">
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={volume}
              onChange={handleVolumeChange}
              className="w-16 h-1 opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </div>

          <button onClick={toggleFullscreen} className="p-1 text-neutral-400 hover:text-white">
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
