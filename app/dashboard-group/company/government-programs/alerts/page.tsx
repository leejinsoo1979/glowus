'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Bell, Plus, Trash2, Check, X,
  Calendar, Tag, Mail, Smartphone
} from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'

interface Alert {
  id: string
  alert_type: string
  keywords: string[]
  categories: string[]
  is_active: boolean
  notification_channels: string[]
  created_at: string
}

const ALERT_TYPES = [
  { value: 'deadline', label: '마감 임박', description: '마감 7일 전 알림' },
  { value: 'new_program', label: '신규 공고', description: '새로운 공고 등록 시' },
  { value: 'keyword', label: '키워드 알림', description: '특정 키워드 포함 공고' },
  { value: 'status_change', label: '상태 변경', description: '신청/선정 결과 알림' },
]

const CATEGORIES = ['창업', 'R&D', 'TIPS', '바우처', '인증', '수출', '고용']
const CHANNELS = [
  { value: 'in_app', label: '앱 내 알림', icon: Bell },
  { value: 'email', label: '이메일', icon: Mail },
  { value: 'push', label: '푸시 알림', icon: Smartphone },
]

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    alert_type: 'deadline',
    keywords: [] as string[],
    categories: [] as string[],
    notification_channels: ['in_app']
  })
  const [keywordInput, setKeywordInput] = useState('')
  const { themeColor } = useThemeStore()

  useEffect(() => {
    fetchAlerts()
  }, [])

  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/government-programs/alerts')
      const data = await res.json()
      setAlerts(data.alerts || [])
    } catch (error) {
      console.error('Failed to fetch alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  const createAlert = async () => {
    try {
      const res = await fetch('/api/government-programs/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      if (data.alert) {
        setAlerts([data.alert, ...alerts])
        setShowForm(false)
        setFormData({
          alert_type: 'deadline',
          keywords: [],
          categories: [],
          notification_channels: ['in_app']
        })
      }
    } catch (error) {
      console.error('Failed to create alert:', error)
    }
  }

  const toggleAlert = async (alert: Alert) => {
    try {
      const res = await fetch('/api/government-programs/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: alert.id, is_active: !alert.is_active })
      })
      const data = await res.json()
      if (data.alert) {
        setAlerts(alerts.map(a => a.id === alert.id ? data.alert : a))
      }
    } catch (error) {
      console.error('Failed to toggle alert:', error)
    }
  }

  const deleteAlert = async (id: string) => {
    try {
      await fetch(`/api/government-programs/alerts?id=${id}`, { method: 'DELETE' })
      setAlerts(alerts.filter(a => a.id !== id))
    } catch (error) {
      console.error('Failed to delete alert:', error)
    }
  }

  const addKeyword = () => {
    if (keywordInput.trim() && !formData.keywords.includes(keywordInput.trim())) {
      setFormData({ ...formData, keywords: [...formData.keywords, keywordInput.trim()] })
      setKeywordInput('')
    }
  }

  const removeKeyword = (keyword: string) => {
    setFormData({ ...formData, keywords: formData.keywords.filter(k => k !== keyword) })
  }

  const toggleCategory = (category: string) => {
    setFormData({
      ...formData,
      categories: formData.categories.includes(category)
        ? formData.categories.filter(c => c !== category)
        : [...formData.categories, category]
    })
  }

  const toggleChannel = (channel: string) => {
    setFormData({
      ...formData,
      notification_channels: formData.notification_channels.includes(channel)
        ? formData.notification_channels.filter(c => c !== channel)
        : [...formData.notification_channels, channel]
    })
  }

  const getAlertTypeLabel = (type: string) => {
    return ALERT_TYPES.find(t => t.value === type)?.label || type
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent"
          style={{ borderColor: themeColor }} />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${themeColor}20` }}>
            <Bell className="w-6 h-6" style={{ color: themeColor }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">알림 설정</h1>
            <p className="text-sm text-zinc-400">관심 공고에 대한 알림을 설정합니다</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
          style={{ backgroundColor: themeColor, color: 'white' }}
        >
          <Plus className="w-4 h-4" />
          알림 추가
        </button>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-6"
        >
          <h3 className="text-lg font-semibold text-white">새 알림 만들기</h3>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">알림 유형</label>
            <div className="grid grid-cols-2 gap-3">
              {ALERT_TYPES.map(type => (
                <button
                  key={type.value}
                  onClick={() => setFormData({ ...formData, alert_type: type.value })}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    formData.alert_type === type.value
                      ? 'border-current bg-current/10'
                      : 'border-zinc-700 hover:border-zinc-600'
                  }`}
                  style={formData.alert_type === type.value ? { borderColor: themeColor, color: themeColor } : {}}
                >
                  <div className="font-medium text-white">{type.label}</div>
                  <div className="text-xs text-zinc-500">{type.description}</div>
                </button>
              ))}
            </div>
          </div>

          {formData.alert_type === 'keyword' && (
            <div>
              <label className="block text-sm text-zinc-400 mb-2">키워드</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={keywordInput}
                  onChange={e => setKeywordInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && addKeyword()}
                  placeholder="키워드 입력 후 Enter"
                  className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
                />
                <button
                  onClick={addKeyword}
                  className="px-4 py-2 rounded-lg bg-zinc-700 text-white hover:bg-zinc-600"
                >
                  추가
                </button>
              </div>
              {formData.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.keywords.map(keyword => (
                    <span
                      key={keyword}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-sm"
                      style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
                    >
                      {keyword}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() => removeKeyword(keyword)}
                      />
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm text-zinc-400 mb-2">카테고리 필터 (선택)</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(category => (
                <button
                  key={category}
                  onClick={() => toggleCategory(category)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    formData.categories.includes(category)
                      ? 'bg-current/20 text-current'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                  style={formData.categories.includes(category) ? { backgroundColor: `${themeColor}20`, color: themeColor } : {}}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">알림 채널</label>
            <div className="flex gap-3">
              {CHANNELS.map(channel => (
                <button
                  key={channel.value}
                  onClick={() => toggleChannel(channel.value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    formData.notification_channels.includes(channel.value)
                      ? 'border-current bg-current/10'
                      : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}
                  style={formData.notification_channels.includes(channel.value) ? { borderColor: themeColor, color: themeColor } : {}}
                >
                  <channel.icon className="w-4 h-4" />
                  {channel.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            >
              취소
            </button>
            <button
              onClick={createAlert}
              className="px-4 py-2 rounded-lg text-white"
              style={{ backgroundColor: themeColor }}
            >
              알림 만들기
            </button>
          </div>
        </motion.div>
      )}

      <div className="space-y-4">
        {alerts.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <Bell className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>설정된 알림이 없습니다</p>
          </div>
        ) : (
          alerts.map((alert, index) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`bg-zinc-900/50 border rounded-xl p-5 ${
                alert.is_active ? 'border-zinc-800' : 'border-zinc-800/50 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: alert.is_active ? `${themeColor}20` : '#27272a' }}
                  >
                    <Bell
                      className="w-5 h-5"
                      style={{ color: alert.is_active ? themeColor : '#71717a' }}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">
                        {getAlertTypeLabel(alert.alert_type)}
                      </span>
                      {!alert.is_active && (
                        <span className="px-2 py-0.5 rounded text-xs bg-zinc-800 text-zinc-500">
                          비활성
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-sm text-zinc-500">
                      {alert.keywords.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {alert.keywords.join(', ')}
                        </span>
                      )}
                      {alert.categories.length > 0 && (
                        <span>• {alert.categories.join(', ')}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleAlert(alert)}
                    className={`p-2 rounded-lg transition-colors ${
                      alert.is_active
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteAlert(alert.id)}
                    className="p-2 rounded-lg bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
