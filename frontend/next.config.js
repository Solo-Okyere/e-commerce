/** @type {import('next').NextConfig} */
/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');

const internalApiPort = process.env.INTERNAL_API_PORT || '5001';
const defaultInternalApiOrigin = `http://127.0.0.1:${internalApiPort}`;
const backendOrigin =
  process.env.INTERNAL_API_ORIGIN ||
  (process.env.NODE_ENV === 'production'
    ? defaultInternalApiOrigin
    : process.env.BACKEND_URL ||
      (process.env.BACKEND_HOSTPORT ? `http://${process.env.BACKEND_HOSTPORT}` : undefined) ||
      process.env.NEXT_PUBLIC_API_URL ||
      defaultInternalApiOrigin);
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
