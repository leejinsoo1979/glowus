/**
 * App Configuration - Single Source of Truth
 */

export const APP_CONFIG = {
  name: 'GlowUS',
  description: 'AI 기반 올인원 생산성 앱',
  features: ['코딩 지원', '문서 작성', '이미지 생성', '코드 시각화'],
} as const

export type AppConfig = typeof APP_CONFIG
