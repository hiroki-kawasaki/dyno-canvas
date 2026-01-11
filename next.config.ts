import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: process.env.DYNOCANVAS_STANDALONE === 'true' ? 'standalone' : undefined,
    basePath: process.env.DYNACANVAS_BASE_PATH || '',
    serverExternalPackages: ['pino', 'pino-pretty'],
};

export default nextConfig;
