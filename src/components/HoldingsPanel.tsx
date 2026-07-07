import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { motion } from "framer-motion";
import { HoldingsResult } from "../lib/holdings";
import { fmtUsd, fmtHuf } from "../lib/format";
import { exportHoldings } from "../lib/csv";

const COLORS = ["#22d3ee", "#67e8f9", "#38bdf8", "#818cf8", "#a78bfa", "#c084fc", "#5eead4", "#94a3b8"];

export function HoldingsPanel({ data, currency }: { data: HoldingsResult; currency: "usd" | "huf" }) {
  const fmt = currency === "usd" ? fmtUsd : fmtHuf;
  const total = currency === "usd" ? data.totalUsd : data.totalHuf;
  const val = (h: { valueUsd: number; valueHuf: number }) => (currency === "usd" ? h.valueUsd : h.valueHuf);

  const top = data.holdings.slice(0, 7);
  const restVal = data.holdings.slice(7).reduce((s, h) => s + val(h), 0);
  const pie = [
    ...top.map((h) => ({ name: h.symbol, value: val(h) })),
    ...(restVal > 0 ? [{ name: "Egyéb", value: restVal }] : []),
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Token-portfólió ({data.tokenCount} eszköz)</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Összérték: <span className="text-cyan-soft font-semibold">{fmt(total)}</span>
            <span className="text-slate-600"> · {currency === "usd" ? fmtHuf(data.totalHuf) : fmtUsd(data.totalUsd)}</span>
            {data.dustFiltered > 0 && <span className="text-slate-600"> · {data.dustFiltered} spam/dust szűrve</span>}
          </p>
        </div>
        <button
          onClick={() => exportHoldings(data.address, data.holdings)}
          className="px-3 py-1.5 rounded-lg text-xs glass glass-hover text-slate-300"
        >
          CSV export
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pie} dataKey="value" nameKey="name" innerRadius={52} outerRadius={84} paddingAngle={2} stroke="none">
                {pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#0d1428", border: "1px solid rgba(103,232,249,0.25)", borderRadius: 12, color: "#e8eefc" }}
                formatter={(v: number, n) => [fmt(v), n]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {data.holdings.map((h, i) => (
            <div key={h.contract + i} className="flex items-center justify-between text-sm py-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COLORS[Math.min(i, 7) % COLORS.length] }} />
                <span className="text-slate-200 font-medium">{h.symbol}</span>
                <span className="text-slate-500 text-xs truncate">
                  {h.amount.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                </span>
              </div>
              <div className="text-right shrink-0">
                <div className="text-slate-200">{fmt(val(h))}</div>
                <div className="text-[11px] text-slate-500">{h.allocationPct.toFixed(1)}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
