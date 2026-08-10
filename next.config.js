/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "@sparticuz/chromium",
      "puppeteer-core",
    ],

    outputFileTracingIncludes: {
      "/api/tests/[id]/export-pdf": [
        "./node_modules/@sparticuz/chromium/bin/**/*",
      ],
      "/api/dpps/[id]/export-pdf": [
        "./node_modules/@sparticuz/chromium/bin/**/*",
      ],
    },
  },
};

module.exports = nextConfig;