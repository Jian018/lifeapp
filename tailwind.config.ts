import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#07090b",
        panel: "#111418",
        line: "#252a31",
        acid: "#c8ff3d",
        coral: "#ff675c",
        sky: "#70d6ff"
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Arial", "sans-serif"],
        display: ["var(--font-space)", "Arial", "sans-serif"]
      },
      boxShadow: {
        card: "0 20px 60px rgba(0,0,0,.24)"
      },
      animation: {
        "pulse-soft": "pulse 2.4s cubic-bezier(0.4,0,0.6,1) infinite"
      }
    }
  },
  plugins: []
} satisfies Config;
