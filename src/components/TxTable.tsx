import { useState } from "react";
import { TxRow } from "../lib/compute";
import { fmtUsd, fmtHuf, fmtDate } from "../lib/format";

export function TxTable({ rows, currency }: { rows: TxRow[]; currency: "usd" | "huf" }) {
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
        <h3 className="text-sm font-semibold text-slate-200">Tranzakciók</h3>
        <div className="flex gap-1">
          <Btn k="all" label="Mind" /><Btn k="in" label="Be" /><Btn k="out" label="Ki" /><Btn k="eth" label="ETH" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-white/5">
              <th className="py-2 pr-3 font-medium">Dátum</th>
              <th className="py-2 pr-3 font-medium">Irány</th>
              <th className="py-2 pr-3 font-medium">Eszköz</th>
              <th className="py-2 pr-3 font-medium text-right">Mennyiség</th>
              <th className="py-2 pr-3 font-medium text-right">Érték</th>
              <th className="py-2 font-medium text-right">Gas</th>
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, 60).map((r, i) => (
              <tr key={r.hash + i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">{fmtDate(r.timeStamp)}</td>
                <td className="py-2 pr-3">
                  <span className={r.direction === "in" ? "text-cyan-soft" : "text-slate-400"}>
                    {r.direction === "in" ? "↓ be" : "↑ ki"}
                  </span>
                  {r.failed && <span className="ml-1 text-red-400 text-xs">hibás</span>}
                </td>
                <td className="py-2 pr-3 text-slate-200">{r.kind}</td>
                <td className="py-2 pr-3 text-right text-slate-300 whitespace-nowrap">
                  {r.amount.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                </td>
                <td className="py-2 pr-3 text-right text-slate-200 whitespace-nowrap">
                  {r.kind === "ETH" && val(r) > 0 ? fmt(val(r)) : <span className="text-slate-600">—</span>}
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
        <p className="text-xs text-slate-500 mt-3 text-center">Az első 60 sor látszik ({shown.length} összesen).</p>
      )}
    </div>
  );
}
