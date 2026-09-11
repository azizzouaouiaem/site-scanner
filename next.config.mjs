/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the tracing root to this project so Next.js doesn't get confused by
  // sibling lockfiles elsewhere on disk (this lives inside a larger monorepo).
  outputFileTracingRoot: import.meta.dirname,
  // Chromium and playwright-core ship native/binary assets that must not be
  // bundled by webpack; they need to be required as real node_modules at
  // runtime. axe-core is also excluded so its UMD build is read from disk
  // as-is instead of being reprocessed by webpack.
  serverExternalPackages: ['@sparticuz/chromium', 'playwright-core', 'axe-core'],
};

export default nextConfig;
