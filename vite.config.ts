import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 4173, allowedHosts: [".trycloudflare.com"] },
  build: {
    // #WO-5: vendor code-splitting — a 710KB monolit chunk szétbontása, hogy a nehéz
    // charting/animáció külön cache-elhető chunkba kerüljön (react-vendor ritkán változik).
    // A recharts (~534KB) chunk mostantól LAZY (App.tsx Suspense) → NINCS az első festés
    // kritikus útján. A limit-emelés csak a (már nem releváns) blocking-warning elnémítása.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          charts: ["recharts"],
          motion: ["framer-motion"],
        },
      },
    },
  },
});
