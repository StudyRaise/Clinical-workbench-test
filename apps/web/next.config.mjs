/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@repo/prompts', '@repo/llm-clients', '@repo/contracts']
};

export default nextConfig;
