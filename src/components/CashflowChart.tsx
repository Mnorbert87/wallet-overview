import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { MonthFlow } from "../lib/compute";
import { monthLabel, fmtUsd, fmtHuf } from "../lib/format";

export function CashflowChart({ data, currency }: { data: MonthFlow[]; currency: "usd" | "huf" }) {
  const rows = data.map((m) => ({
    ym: monthLabel(m.ym),
    be: currency === "usd" ? m.inUsd : m.inHuf,
    ki: currency === "usd" ? -m.outUsd : -m.outHuf,
  }));
  const fmt = currency === "usd" ? fmtUsd : fmtHuf;

  if (!rows.length) {
    return <div className="text-slate-500 text-sm py-10 text-center">Nincs native ETH cashflow ehhez a tárcához.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} stackOffset="sign">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(103,232,249,0.08)" vertical={false} />
        <XAxis dataKey="ym" tick={{ fill: "#7b8bb0", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis tick={{ fill: "#7b8bb0", fontSize: 11 }} tickLine={false} axisLine={false}
          tickFormatter={(v) => fmt(Math.abs(v)).replace(/\s?(Ft|\$)/, "")} width={54} />
        <Tooltip
          contentStyle={{ background: "#0d1428", border: "1px solid rgba(103,232,249,0.25)", borderRadius: 12, color: "#e8eefc" }}
          formatter={(v: number, n) => [fmt(Math.abs(v)), n === "be" ? "Beérkezett" : "Kiment"]}
          cursor={{ fill: "rgba(34,211,238,0.06)" }}
        />
        <Bar dataKey="be" fill="#22d3ee" radius={[3, 3, 0, 0]} maxBarSize={26} />
        <Bar dataKey="ki" fill="#6b7280" radius={[0, 0, 3, 3]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}
