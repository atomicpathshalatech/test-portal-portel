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
        brand: {
          DEFAULT: "#9D4400", // Atomic orange (primary)
          dark: "#773200",
          light: "#FFF1E8",
          container: "#FF7300",
        },
        success: "#16A34A",
        warning: "#D97706",
        danger: "#BA1A1A",
        ink: "#191C1D",
        "ink-soft": "#594236",
        surface: {
          DEFAULT: "#F8F9FA",
          low: "#F3F4F5",
          container: "#EDEEEF",
          high: "#E7E8E9",
          highest: "#E1E3E4",
          lowest: "#FFFFFF",
        },
        panel: "#F8F9FA",
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
