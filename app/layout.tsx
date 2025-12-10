import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'StartupShow - 스타트업 운영 자동화 플랫폼',
  description: '스타트업과 투자자를 연결하는 통합 플랫폼. 업무 관리부터 투자 유치까지.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  )
}
