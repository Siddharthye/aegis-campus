import type { NextConfig } from 'next'

/**
 * SIREN is designed to be called cross-origin by a buyer's application, so every
 * `/api/*` response carries permissive CORS headers. Without these a buyer would
 * have to proxy us server-side, which defeats the ten-minute integration promise.
 */
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ]
  },
}

export default nextConfig
