/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b1020",
        panel: "#111834",
        cyan: { DEFAULT: "#22d3ee", soft: "#67e8f9", deep: "#0e7490" },
      },
      fontFamily: {
        grotesk: ["'Space Grotesk'", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
