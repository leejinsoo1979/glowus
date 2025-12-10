import type { Metadata } from 'next'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'GlowUS - Founders OS for Real-Time Growth',
  description: '스타트업 창업자를 위한 AI 기반 운영 플랫폼. 업무 관리부터 투자 유치까지.',
}

// 페이지 로드 전 localStorage에서 accent color를 즉시 적용하는 스크립트
const accentColorScript = `
(function() {
  try {
    var stored = localStorage.getItem('theme-storage');
    if (stored) {
      var parsed = JSON.parse(stored);
      var accentId = parsed.state && parsed.state.accentColor;
      var colors = {
        blue: { color: '#3b82f6', hover: '#2563eb', rgb: '59, 130, 246' },
        purple: { color: '#8b5cf6', hover: '#7c3aed', rgb: '139, 92, 246' },
        green: { color: '#22c55e', hover: '#16a34a', rgb: '34, 197, 94' },
        orange: { color: '#f97316', hover: '#ea580c', rgb: '249, 115, 22' },
        pink: { color: '#ec4899', hover: '#db2777', rgb: '236, 72, 153' },
        cyan: { color: '#06b6d4', hover: '#0891b2', rgb: '6, 182, 212' },
        red: { color: '#ef4444', hover: '#dc2626', rgb: '239, 68, 68' },
        yellow: { color: '#eab308', hover: '#ca8a04', rgb: '234, 179, 8' }
      };
      var accent = colors[accentId] || colors.blue;
      document.documentElement.style.setProperty('--accent-color', accent.color);
      document.documentElement.style.setProperty('--accent-color-hover', accent.hover);
      document.documentElement.style.setProperty('--accent-color-rgb', accent.rgb);
    }
  } catch (e) {}
})();
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: accentColorScript }} />
      </head>
      <body className="min-h-screen">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
