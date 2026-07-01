import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  async headers() {
    return [
      {
        source: '/api/upload-proxy',
        headers: [
          { key: 'x-vercel-disable-body-size-limit', value: '1' },
        ],
      },
    ]
  },
};

export default nextConfig;