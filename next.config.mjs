/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a second instance run beside `next dev` without sharing .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  compress: true,
  experimental: { optimizePackageImports: ['lucide-react', 'framer-motion'] },
};

export default nextConfig;
