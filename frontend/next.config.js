/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
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
};

module.exports = nextConfig;
