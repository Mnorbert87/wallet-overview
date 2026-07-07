import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { motion } from "framer-motion";
import { Portfolio, CHAIN_META } from "../lib/multichain";
import { fmtUsd, fmtHuf } from "../lib/format";

const COLORS = ["#22d3ee", "#67e8f9", "#38bdf8", "#818cf8", "#a78bfa", "#c084fc", "#5eead4", "#94a3b8"];

export function PortfolioPanel({ p, currency }: { p: Portfolio; currency: "usd" | "huf" }) {
  const fmt = currency === "usd" ? fmtUsd : fmtHuf;
  const total = currency === "usd" ? p.totalUsd : p.totalHuf;
  const val = (a: { valueUsd: number; valueHuf: number }) => (currency === "usd" ? a.valueUsd : a.valueHuf);

  const top = p.assets.slice(0, 7);
  const restVal = p.assets.slice(7).reduce((s, a) => s + val(a), 0);
  const pie = [...top.map((a) => ({ name: a.symbol, value: val(a) })), ...(restVal > 0 ? [{ name: "Egyéb", value: restVal }] : [])];

  const chainRows = Object.entries(p.perChainUsd).sort((a, b) => b[1] - a[1]);
  const chainMeta = (id: string) => CHAIN_META[id] || { name: id, color: "#64748b" };

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Portfólió — {p.assetCount} ellenőrzött eszköz, {p.chains.length} lánc</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            <span className="text-slate-600">
              ár-forrás: {p.pricingMode === "coingecko" ? "CoinGecko (teljes)" : "curated allowlist (keyless)"}
              {p.dustFiltered > 0 && ` · ${p.dustFiltered} dust szűrve`}
              {p.unverifiedAssets.length > 0 && ` · ${p.unverifiedAssets.length} nem ellenőrzött árú (nincs a totálban)`}
              {" · "}
            </span>
            {p.chainErrors.length > 0 && <span className="text-amber-400/70">{p.chainErrors.join(", ")} lánc most nem elérhető</span>}
          </p>
        </div>
      </div>

      {/* Per-lánc allokáció-sáv */}
      <div className="flex rounded-lg overflow-hidden h-2.5 mb-2">
        {chainRows.map(([id, v]) => (
          <div key={id} style={{ width: `${(v / p.totalUsd) * 100}%`, background: chainMeta(id)?.color || "#64748b" }} title={`${chainMeta(id)?.name}: ${fmtUsd(v)}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-5 text-xs">
        {chainRows.map(([id, v]) => (
          <span key={id} className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2 h-2 rounded-sm" style={{ background: chainMeta(id)?.color }} />
            {chainMeta(id)?.name} · {((v / p.totalUsd) * 100).toFixed(0)}%
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pie} dataKey="value" nameKey="name" innerRadius={52} outerRadius={84} paddingAngle={2} stroke="none">
                {pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#0d1428", border: "1px solid rgba(103,232,249,0.25)", borderRadius: 12, color: "#e8eefc" }} formatter={(v: number, n) => [fmt(v), n]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {p.assets.map((a, i) => (
            <div key={a.chain + a.contract + i} className="flex items-center justify-between text-sm py-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COLORS[Math.min(i, 7) % COLORS.length] }} />
                <span className="text-slate-200 font-medium">{a.symbol}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: `${a.chainColor}22`, color: a.chainColor }}>{a.chainName}</span>
                <span className="text-slate-500 text-xs truncate">{a.amount.toLocaleString("en-US", { maximumFractionDigits: 4 })}</span>
              </div>
              <div className="text-right shrink-0">
                <div className="text-slate-200">{fmt(val(a))}</div>
                <div className="text-[11px] text-slate-500">{a.allocationPct.toFixed(1)}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Nem ellenőrzött árú tokenek — láthatók, de NINCSENEK a totálban (a
          Blockscout-ár spam-tokeneknél hamis lehet; itt csak a mennyiség biztos). */}
      {p.unverifiedAssets.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <p className="text-xs text-slate-500 mb-2">
            Nem ellenőrzött árú tokenek ({p.unverifiedAssets.length}) — a mennyiség valós, de az árat nem
            tudtuk megbízhatóan igazolni, ezért NEM számoltuk a portfólió-értékbe.
            {p.pricingMode === "allowlist" && " (Saját ingyenes CoinGecko-kulccsal ezek is árazódnak.)"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {p.unverifiedAssets.slice(0, 24).map((a, i) => (
              <span key={a.chain + a.contract + i} className="text-[11px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400">
                {a.symbol} <span className="text-slate-600">{a.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
