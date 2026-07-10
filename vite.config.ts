import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// #WO key-leak: KIKÉNYSZERÍTETT guard (nem csak README-dokumentáció). A VITE_ prefixű
// kulcsok a kliens-bundle-be fordulnak — production buildben ez csendes szivárgás.
// Ha bármelyik kulcs nem üres prod-buildkor, a build MEGÁLL. Kulcsos deploy csak
// szerver-oldali proxy mögött biztonságos; addig keyless-módban élesíthető.
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const leaky = ["VITE_ETHERSCAN_KEY", "VITE_HELIUS_KEY"].filter((k) => env[k]);
  const allowClientKeys = process.env.ALLOW_CLIENT_KEYS === "1";
  if (command === "build" && mode === "production" && leaky.length && !allowClientKeys) {
    throw new Error(
      `[wallet-overview] Kulcs-szivárgás blokkolva: ${leaky.join(", ")} nem üres production buildben.\n` +
      `A VITE_ kulcsok a kliens-bundle-be kerülnek. Éles deployhoz tedd szerver-oldali proxy mögé,\n` +
      `vagy építs kulcs nélkül (keyless). Override CSAK ha proxy védi: ALLOW_CLIENT_KEYS=1.`,
    );
  }
  return {
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
  };
});
