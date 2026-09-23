import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: { root: process.cwd() },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['bcryptjs', 'better-sqlite3'],
}

export default nextConfig
