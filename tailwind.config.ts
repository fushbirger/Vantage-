import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0d2b2a",
        muted: "#607472",
        paper: "#f4f1e9",
        card: "#fffdf8",
        line: "#e2ddd0",
        teal: {
          50: "#eef8f5",
          100: "#d6eee7",
          200: "#aaddcf",
          300: "#72c4b1",
          400: "#3ea78f",
          500: "#1f8a74",
          600: "#0f6b5d",
          700: "#0d564c",
          800: "#0d463f",
          900: "#0c3a35",
        },
        amber: {
          100: "#fdf1cf",
          300: "#f8d477",
          400: "#f4bf3e",
          500: "#eea90f",
        },
        coral: "#d9542b",
      },
      fontFamily: {
        sans: [
          "Manrope",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        display: ["Fraunces", "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 14px 40px -24px rgba(13, 43, 42, 0.45)",
        lift: "0 20px 60px -30px rgba(13, 43, 42, 0.55)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pop: {
          "0%": { opacity: "0", transform: "scale(.97)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        rise: "rise .35s cubic-bezier(.22,1,.36,1) both",
        pop: "pop .22s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
