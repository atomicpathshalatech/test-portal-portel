/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "@sparticuz/chromium",
      "puppeteer-core",
      "@napi-rs/canvas",
      "pdfjs-dist",
    ],

    outputFileTracingIncludes: {
      "/api/tests/[id]/export-pdf": [
        "./node_modules/@sparticuz/chromium/bin/**/*",
      ],
      "/api/dpps/[id]/export-pdf": [
        "./node_modules/@sparticuz/chromium/bin/**/*",
      ],
      "/api/module-studio/[id]/extract": [
        "./node_modules/@napi-rs/canvas/**/*",
        "./node_modules/pdfjs-dist/**/*",
      ],
    },
  },
};

module.exports = nextConfig;
