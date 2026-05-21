/** @type {import('next').NextConfig} */
const path = require('path');

const backendOrigin =
  process.env.BACKEND_URL ||
  (process.env.BACKEND_HOSTPORT ? `http://${process.env.BACKEND_HOSTPORT}` : undefined) ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:5000';
const isStaticExport = process.env.STATIC_EXPORT === 'true';

const nextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  ...(isStaticExport ? { output: 'export' } : {}),
  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'nordheim-mode.de',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  outputFileTracingRoot: path.resolve(__dirname),
  ...(isStaticExport
    ? {}
    : {
        async rewrites() {
          return [
            {
              source: '/api/:path*',
              destination: `${backendOrigin}/api/:path*`,
            },
            {
              source: '/uploads/:path*',
              destination: `${backendOrigin}/uploads/:path*`,
            },
          ];
        },
      }),
};

module.exports = nextConfig;
