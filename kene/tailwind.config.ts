import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#0B1F1D",
          800: "#12302C",
          700: "#1B403A",
        },
        brand: {
          50: "#E9F7F4",
          100: "#CDEDE6",
          200: "#9DDCD0",
          300: "#66C4B4",
          400: "#35A695",
          500: "#0B7E72",
          600: "#0A6A60",
          700: "#0A554E",
          800: "#0A463F",
          900: "#083A35",
        },
        sun: {
          50: "#FEF6E7",
          100: "#FCE9C2",
          200: "#F8D68A",
          300: "#F2BD4E",
          400: "#E9A52A",
          500: "#D98B12",
          600: "#B36A0C",
          700: "#8C4F0C",
          800: "#6E3D0D",
          900: "#5A320D",
        },
        sand: "#F7F6F2",
        canvas: "#F6F9F8",
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "Plus Jakarta Sans",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,31,29,0.04), 0 8px 24px -12px rgba(11,31,29,0.14)",
        lift: "0 24px 60px -24px rgba(11,31,29,0.3)",
        soft: "0 12px 32px -12px rgba(11,31,29,0.12)",
        float: "0 18px 44px -16px rgba(11,31,29,0.18)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateX(16px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.35s ease-out both",
        "slide-in": "slide-in 0.25s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
