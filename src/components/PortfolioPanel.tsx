import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { motion } from "framer-motion";
import { Portfolio, CHAIN_META } from "../lib/multichain";
import { fmtUsd, fmtHuf } from "../lib/format";
import { useT } from "../lib/i18n";
import { exportAssets } from "../lib/csv";

const COLORS = ["#22d3ee", "#67e8f9", "#38bdf8", "#818cf8", "#a78bfa", "#c084fc", "#5eead4", "#94a3b8"];

export function PortfolioPanel({ p, currency }: { p: Portfolio; currency: "usd" | "huf" }) {
  const t = useT();
  // #WO-31: tárcák vannak, de 0 eszköz — tiszta üres-állapot a félrevezető
  // "0 eszköz, 0 lánc" fejléc + üres pie/allokáció-sáv helyett.
  if (p.assets.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-5 mb-6 text-sm text-slate-400 text-center py-10">
        {t("pf.noHoldings")}
      </motion.div>
    );
  }
  const fmt = currency === "usd" ? fmtUsd : fmtHuf;
  const total = currency === "usd" ? p.totalUsd : p.totalHuf;
  const val = (a: { valueUsd: number; valueHuf: number }) => (currency === "usd" ? a.valueUsd : a.valueHuf);

  // A pie/allokáció CSAK a verified (totálban lévő) eszközökből — hogy egyezzen a headline-nel.
  const verifiedAssets = p.assets.filter((a) => a.verified);
  const top = verifiedAssets.slice(0, 7);
  const restVal = verifiedAssets.slice(7).reduce((s, a) => s + val(a), 0);
  const pie = [...top.map((a) => ({ name: a.symbol, value: val(a) })), ...(restVal > 0 ? [{ name: t("pf.other"), value: restVal }] : [])];
  const unverifiedList = p.assets.filter((a) => !a.verified);
  const unverifiedInList = unverifiedList.length;
  // #13299/2: a kihagyott (nem-verifikált árú) eszközök best-effort összértéke —
  // ez NINCS a totálban; keyless módban CG-kulccsal árazódna. Prominensen jelezzük.
  const uncoveredVal = unverifiedList.reduce((s, a) => s + val(a), 0);

  const chainRows = Object.entries(p.perChainUsd).sort((a, b) => b[1] - a[1]);
  const chainMeta = (id: string) => CHAIN_META[id] || { name: id, color: "#64748b" };

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">{t("pf.title", { n: p.assetCount, c: p.chains.length })}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            <span className="text-slate-600">
              {t("pf.priceSrc")}: {p.pricingMode === "coingecko" ? t("pf.src.coingecko") : t("pf.src.allowlist")}
              {p.dustFiltered > 0 && ` · ${t("pf.dustFiltered", { n: p.dustFiltered })}`}
              {" · "}
            </span>
            {p.chainErrors.length > 0 && <span className="text-amber-400/70">{t("pf.chainDown", { c: p.chainErrors.join(", ") })}</span>}
          </p>
        </div>
        {p.assets.length > 0 && (
          <button
            onClick={() => exportAssets(p.addresses[0] || "wallet", p.assets)}
            className="px-3 py-1 rounded-lg text-xs text-slate-400 hover:text-slate-200 border border-white/10 hover:border-white/20 transition-colors shrink-0"
          >
            {t("pf.csv")}
          </button>
        )}
      </div>

      {/* Per-lánc allokáció-sáv */}
      <div className="flex rounded-lg overflow-hidden h-2.5 mb-2">
        {chainRows.map(([id, v]) => {
          const pct = p.totalUsd ? (v / p.totalUsd) * 100 : 0; // #WO-10: 0-guard a NaN% ellen
          return <div key={id} style={{ width: `${pct}%`, background: chainMeta(id)?.color || "#64748b" }} title={`${chainMeta(id)?.name}: ${fmtUsd(v)}`} />;
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-5 text-xs">
        {chainRows.map(([id, v]) => {
          const pct = p.totalUsd ? (v / p.totalUsd) * 100 : 0; // #WO-10: 0-guard a NaN% ellen
          return (
            <span key={id} className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-sm" style={{ background: chainMeta(id)?.color }} />
              {chainMeta(id)?.name} · {pct.toFixed(0)}%
            </span>
          );
        })}
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
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {p.assets.length === 0 && (
            <div className="text-sm text-slate-500 py-6 text-center">{t("pf.emptyList")}</div>
          )}
          {p.assets.map((a, i) => (
            <div key={a.chain + a.contract + i} className="flex items-center justify-between text-sm py-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: a.verified ? COLORS[Math.min(i, 7) % COLORS.length] : "#475569" }} />
                <span className="text-slate-200 font-medium">{a.symbol}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: `${a.chainColor}22`, color: a.chainColor }}>{a.chainName}</span>
                {!a.verified && <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0 bg-amber-400/10 text-amber-400/80" title={t("pf.priceUnverifiedTip")}>{t("pf.priceUnverified")}</span>}
                {a.oversized && <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0 bg-amber-400/15 text-amber-300/90" title={t("pf.oversizedTip")}>⚠ {t("pf.oversizedBadge")}</span>}
                <span className="text-slate-500 text-xs truncate">{a.amount.toLocaleString("en-US", { maximumFractionDigits: 4 })}</span>
              </div>
              <div className="text-right shrink-0">
                {/* #13299/3: nem-verifikált (esetleg scam-árú) tokennél NEM írunk ki
                    konkrét dollárértéket — csak "≈ ?" jelzést, hogy a hamis ár ne
                    tűnjön valósnak. A verifikáltak mutatják a valós értéket. */}
                <div className={a.verified ? "text-slate-200" : "text-slate-500"} title={a.verified ? undefined : t("pf.priceUnverifiedTip")}>
                  {a.verified ? fmt(val(a)) : "≈ ?"}
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 justify-end">
                  {a.verified && <span>{a.allocationPct.toFixed(1)}%</span>}
                  {/* QUICK-WIN #5: per-token 24h ár-változás chip (ha CG-adat van rá) */}
                  {typeof a.change24h === "number" && (
                    <span className={a.change24h >= 0 ? "text-emerald-400/80" : "text-red-400/80"}>
                      {a.change24h >= 0 ? "▲" : "▼"}{Math.abs(a.change24h).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {unverifiedInList > 0 && p.pricingMode === "allowlist" && (
        <div className="mt-3 pt-3 border-t border-white/5 text-[11px] text-amber-400/90 leading-relaxed">
          {t("pf.coverage", { covered: verifiedAssets.length, total: p.assets.length, uncovered: fmt(uncoveredVal) })}
          {" "}{t("pf.cgHint")}
        </div>
      )}
      {p.holdingsTruncated && (
        <p className="text-[11px] text-amber-400/70 mt-2">{t("pf.truncated")}</p>
      )}
      {/* A5: a 'sol' degradáció KÜLÖN copy-t kap (permanens keyless-korlát, nem
          tranziens rate-limit) — a generikus "próbáld újra" a többi láncra marad. */}
      {(() => {
        const generic = (p.degradedChains || []).filter((c) => c !== "sol");
        return (
          <>
            {generic.length > 0 && (
              <p className="text-[11px] text-amber-400/80 mt-2">{t("pf.tokensDegraded", { chains: generic.join(", ") })}</p>
            )}
            {p.degradedChains?.includes("sol") && (
              <p className="text-[11px] text-amber-400/80 mt-2">{t("pf.solSplKeyless")}</p>
            )}
          </>
        );
      })()}
      {(unverifiedInList > 0 || p.suspiciousFiltered > 0) && (
        <p className="text-[11px] text-slate-500 mt-2">
          {unverifiedInList > 0 && p.pricingMode === "coingecko" && <>{t("pf.unverifiedNote", { n: unverifiedInList })} </>}
          {p.suspiciousFiltered > 0 && <span className="text-amber-400/60">{t("pf.suspicious", { n: p.suspiciousFiltered })} </span>}
        </p>
      )}
    </motion.div>
  );
}
