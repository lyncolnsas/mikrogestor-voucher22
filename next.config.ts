import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: [
    'routeros-client',
    'node-routeros',
    'source-map-support',
    '@whiskeysockets/baileys',
    'pino',
    'pino-pretty',
  ],
  // Allow any device on the 192.168.88.x subnet (hotspot clients, mobile phones, etc.)
  // Next.js supports prefix-based wildcards like "*.localhost"
  allowedDevOrigins: [
    '192.168.88.254',
    '*.192.168.88.254',
    '192.168.88.1',
    '*.192.168.88.1',
    'localhost',
    '127.0.0.1',
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
      {
        source: '/uploads/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'Accept-Ranges',
            value: 'bytes',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ];
  },
};


export default nextConfig;



