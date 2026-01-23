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
  },
}

module.exports = nextConfig
