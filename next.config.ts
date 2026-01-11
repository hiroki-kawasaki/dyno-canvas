import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: process.env.DYNOCANVAS_STANDALONE === 'true' ? 'standalone' : undefined,
    basePath: process.env.DYNOCANVAS_BASE_PATH || '',
    serverExternalPackages: ['pino', 'pino-pretty'],
};

export default nextConfig;
