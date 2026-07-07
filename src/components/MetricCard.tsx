import { motion } from "framer-motion";
import { AnimatedNumber } from "./AnimatedNumber";
import { fmtUsd, fmtHuf } from "../lib/format";

// Minden érték USD + HUF párban. A `primary` dönti melyik a domináns (nagy) szám.
export function MetricCard({
  label,
  usd,
  huf,
  primary,
  hero = false,
  sub,
  animate = false,
  delay = 0,
}: {
  label: string;
  usd: number;
  huf: number;
  primary: "usd" | "huf";
  hero?: boolean;
  sub?: string;
  animate?: boolean;
  delay?: number;
}) {
  const bigVal = primary === "usd" ? usd : huf;
  const bigFmt = primary === "usd" ? fmtUsd : fmtHuf;
  const smallVal = primary === "usd" ? huf : usd;
  const smallFmt = primary === "usd" ? fmtHuf : fmtUsd;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className={`glass glass-hover rounded-2xl p-5 transition-all ${hero ? "sm:col-span-2" : ""}`}
    >
      <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-soft/70">{label}</p>
      <div className={`font-semibold mt-2 ${hero ? "text-4xl sm:text-5xl cyan-text" : "text-2xl text-white"}`}>
        {animate ? <AnimatedNumber value={bigVal} format={bigFmt} /> : bigFmt(bigVal)}
      </div>
      <div className="mt-1 text-sm text-slate-400">
        {animate ? <AnimatedNumber value={smallVal} format={smallFmt} /> : smallFmt(smallVal)}
      </div>
      {sub && <div className="mt-2 text-xs text-slate-500">{sub}</div>}
    </motion.div>
  );
}

export function InfoCard({ label, value, sub, delay = 0 }: { label: string; value: string; sub?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="glass glass-hover rounded-2xl p-5"
    >
      <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-soft/70">{label}</p>
      <div className="text-2xl font-semibold mt-2 text-white">{value}</div>
      {sub && <div className="mt-1 text-sm text-slate-400">{sub}</div>}
    </motion.div>
  );
}
