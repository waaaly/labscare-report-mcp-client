/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@modelcontextprotocol/sdk'],
  serverExternalPackages: ['libreoffice-convert', 'langchain', '@langchain/openai', 'ioredis'], 
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

module.exports = nextConfig;
