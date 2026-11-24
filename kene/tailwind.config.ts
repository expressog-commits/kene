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
          600: "#08665C",
          700: "#045D56",
          800: "#034A44",
          900: "#023833",
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
        canvas: "#F5F7F9",
      },
      fontFamily: {
        sans: [
          "Inter",
          "Plus Jakarta Sans",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: ["Plus Jakarta Sans", "Inter", "-apple-system", "sans-serif"],
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04), 0 4px 16px -8px rgba(15,23,42,0.08)",
        soft: "0 8px 24px -10px rgba(15,23,42,0.10)",
        float: "0 16px 36px -14px rgba(15,23,42,0.14)",
        lift: "0 24px 56px -20px rgba(15,23,42,0.22)",
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
