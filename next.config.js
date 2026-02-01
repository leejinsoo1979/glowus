/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // 빌드 시 타입 체크 비활성화 (개발 중에는 IDE에서 체크)
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['ws'],
    instrumentationHook: true,
  },
  // 🔥 COEP 헤더 제거 - iframe 프리뷰와 충돌
  // WebContainer가 필요하면 neurons 페이지에서만 사용
  async headers() {
    return [
      {
        source: '/dashboard-group/neurons/:path*',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
