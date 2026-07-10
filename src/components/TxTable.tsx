import { useState } from "react";
import { TxRow } from "../lib/compute";
import { fmtUsd, fmtHuf, fmtDate } from "../lib/format";
import { useT } from "../lib/i18n";
import { exportTxs } from "../lib/csv";

export function TxTable({ rows, currency, address }: { rows: TxRow[]; currency: "usd" | "huf"; address?: string }) {
  const t = useT();
  const [filter, setFilter] = useState<"all" | "in" | "out" | "eth">("all");
  const fmt = currency === "usd" ? fmtUsd : fmtHuf;
  const val = (r: TxRow) => (currency === "usd" ? r.usd : r.huf);
  const gas = (r: TxRow) => (currency === "usd" ? r.gasUsd : r.gasHuf);

  const shown = rows.filter((r) =>
    filter === "all" ? true : filter === "eth" ? r.kind === "ETH" : r.direction === filter,
  );

  const Btn = ({ k, label }: { k: typeof filter; label: string }) => (
    <button
      onClick={() => setFilter(k)}
      aria-pressed={filter === k}
      className={`px-3 py-1 rounded-lg text-xs transition-colors ${
        filter === k ? "bg-cyan/20 text-cyan-soft border border-cyan/40" : "text-slate-400 hover:text-slate-200 border border-transparent"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-slate-200">{t("tx.title")}</h3>
        <div className="flex gap-1 items-center flex-wrap">
          <Btn k="all" label={t("tx.all")} /><Btn k="in" label={t("tx.in")} /><Btn k="out" label={t("tx.out")} /><Btn k="eth" label="ETH" />
          {rows.length > 0 && (
            <button
              onClick={() => exportTxs(address || "wallet", rows)}
              className="px-3 py-1 rounded-lg text-xs text-slate-400 hover:text-slate-200 border border-white/10 hover:border-white/20 transition-colors"
            >
              {t("pf.csv")}
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-white/5">
              <th className="py-2 pr-3 font-medium">{t("tx.date")}</th>
              <th className="py-2 pr-3 font-medium">{t("tx.direction")}</th>
              <th className="py-2 pr-3 font-medium">{t("tx.asset")}</th>
              <th className="py-2 pr-3 font-medium text-right">{t("tx.amount")}</th>
              <th className="py-2 pr-3 font-medium text-right">{t("tx.value")}</th>
              <th className="py-2 font-medium text-right">Gas</th>
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, 60).map((r, i) => (
              <tr key={r.hash + i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">{fmtDate(r.timeStamp)}</td>
                <td className="py-2 pr-3">
                  <span className={r.direction === "in" ? "text-cyan-soft" : "text-slate-400"}>
                    {r.direction === "in" ? t("tx.dirIn") : t("tx.dirOut")}
                  </span>
                  {r.failed && <span className="ml-1 text-red-400 text-xs">{t("tx.failed")}</span>}
                </td>
                <td className="py-2 pr-3 text-slate-200">{r.kind}</td>
                <td className="py-2 pr-3 text-right text-slate-300 whitespace-nowrap">
                  {r.amount.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                </td>
                <td className="py-2 pr-3 text-right text-slate-200 whitespace-nowrap">
                  {/* #30: valós transzfer ár nélkül = "n/a" (title), nem "—" (üres) */}
                  {r.kind === "ETH" && val(r) > 0
                    ? fmt(val(r))
                    : r.kind === "ETH" && r.amount > 0
                      ? <span className="text-slate-600" title={t("tx.priceUnavail")}>n/a</span>
                      : <span className="text-slate-600">—</span>}
                </td>
                <td className="py-2 text-right text-slate-500 whitespace-nowrap">
                  {gas(r) > 0 ? fmt(gas(r)) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown.length > 60 && (
        <p className="text-xs text-slate-500 mt-3 text-center">{t("tx.truncated", { n: shown.length })}</p>
      )}
    </div>
  );
}
