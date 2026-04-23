const path = require('path');

module.exports = {
  reactStrictMode: true,
  outputFileTracingRoot: path.resolve(__dirname),
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Allow same-origin meeting media capture while still restricting geolocation.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/api/meetings/meetings/:roomId/carbon',
        destination: '/api/meetings/:roomId/carbon',
        permanent: false,
      },
      {
        source: '/meetings/meetings',
        destination: '/meetings',
        permanent: false,
      },
      {
        source: '/meetings/meetings/:path*',
        destination: '/meetings/:path*',
        permanent: false,
      },
      {
        source: '/shorts',
        destination: '/minis',
        permanent: true,
      },
      {
        source: '/videos',
        destination: '/movies',
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'pixabay.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
};
