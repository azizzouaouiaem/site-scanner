/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the tracing root to this project so Next.js doesn't get confused by
  // sibling lockfiles elsewhere on disk (this lives inside a larger monorepo).
  outputFileTracingRoot: import.meta.dirname,
  // Chromium and playwright-core ship native/binary assets that must not be
  // bundled by webpack; they need to be required as real node_modules at
  // runtime. axe-core stays bundled because its source is injected into the
  // target page and must not depend on a node_modules asset at runtime.
  serverExternalPackages: ['@sparticuz/chromium-min', 'playwright-core'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.module.rules.push({
        test: /axe\.min\.js$/,
        type: 'asset/source',
      });
    }
    return config;
  },
};

export default nextConfig;
