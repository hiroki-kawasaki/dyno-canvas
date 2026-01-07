import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: process.env.DYNACANVAS_DOCKER === 'true' ? 'standalone' : undefined,
    basePath: process.env.DYNACANVAS_BASE_PATH,
    serverExternalPackages: ['pino', 'pino-pretty'],
};

export default nextConfig;
