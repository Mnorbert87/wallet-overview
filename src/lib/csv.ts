import { Holding } from "./holdings";
import { TxRow } from "./compute";
import { fmtDate } from "./format";

function download(name: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function exportHoldings(address: string, holdings: Holding[]) {
  const rows = [
    ["symbol", "name", "contract", "amount", "price_usd", "value_usd", "value_huf", "allocation_pct"],
    ...holdings.map((h) => [
      h.symbol, h.name, h.contract, h.amount, h.priceUsd.toFixed(6),
      h.valueUsd.toFixed(2), Math.round(h.valueHuf), h.allocationPct.toFixed(2),
    ]),
  ];
  download(`holdings_${address.slice(0, 8)}.csv`, rows.map((r) => r.join(",")).join("\n"));
}

export function exportTxs(address: string, txs: TxRow[]) {
  const rows = [
    ["date", "direction", "asset", "amount", "value_usd", "value_huf", "gas_usd", "gas_huf", "failed"],
    ...txs.map((t) => [
      fmtDate(t.timeStamp), t.direction, t.kind, t.amount,
      t.usd.toFixed(2), Math.round(t.huf), t.gasUsd.toFixed(2), Math.round(t.gasHuf), t.failed ? "1" : "0",
    ]),
  ];
  download(`transactions_${address.slice(0, 8)}.csv`, rows.map((r) => r.join(",")).join("\n"));
}
