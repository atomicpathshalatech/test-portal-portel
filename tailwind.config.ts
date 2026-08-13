import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    screens: {
      xs: "380px",
      ...require("tailwindcss/defaultTheme").screens,
    },
    extend: {
      colors: {
        // NOTE ON PALETTE: these values are unified with Atomic OPS's Material
        // Design 3 token set (see atomic-ops/tailwind.config.ts) so the two
        // products read as one ecosystem once merged. Token *names* are kept
        // as-is (brand/ink/surface/etc.) so no className strings elsewhere in
        // this app need to change — only the hex values moved.
        brand: {
          DEFAULT: "#0050cb", // was Atomic orange #9D4400 -> OPS primary
          dark: "#003fa4", // OPS on-primary-fixed-variant
          light: "#dae1ff", // OPS primary-fixed
          container: "#0066ff", // OPS primary-container
        },
        success: "#006643", // OPS tertiary
        warning: "#D97706", // no OPS equivalent defined; kept as-is
        danger: "#BA1A1A", // already matches OPS error exactly
        ink: "#131b2e", // OPS on-surface
        "ink-soft": "#424656", // OPS on-surface-variant
        surface: {
          DEFAULT: "#faf8ff", // OPS background/surface
          low: "#f2f3ff", // OPS surface-container-low
          container: "#eaedff", // OPS surface-container
          high: "#e2e7ff", // OPS surface-container-high
          highest: "#dae2fd", // OPS surface-container-highest
          lowest: "#ffffff",
        },
        panel: "#eaedff", // OPS surface-container
      },
      fontFamily: {
        sans: ["Hanken Grotesk", "Noto Sans Devanagari", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
