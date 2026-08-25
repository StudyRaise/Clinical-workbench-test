/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true
  },
  transpilePackages: ['@repo/prompts', '@repo/llm-clients', '@repo/contracts']
};

export default nextConfig;
