import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false, // hide X-Powered-By (no info leakage)

  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co', pathname: '/**' },
      { protocol: 'https', hostname: 'play-lh.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'upload.wikimedia.org', pathname: '/**' },
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
      { protocol: 'http', hostname: 'nibsaccos.nibbank.com.et' },
      { protocol: 'https', hostname: 'nibsaccos.nibbank.com.et' },
      { protocol: 'http', hostname: 'localhost', port: '9002' },
    ],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // CSP will be set dynamically with nonce in middleware
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN', // Clickjacking protection
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff', // Anti-MIME sniffing
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },

  async redirects() {
    return [
      { source: '/', destination: '/home', permanent: true },
    ];
  },
};

export default nextConfig;
