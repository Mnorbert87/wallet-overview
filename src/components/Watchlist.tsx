import { useState } from "react";
import { motion } from "framer-motion";
import { Wallet } from "../lib/wallets";
import { shortAddr, fmtUsd, fmtHuf } from "../lib/format";

const TYPE_META: Record<string, { label: string; color: string }> = {
  evm: { label: "EVM", color: "#627eea" },
  sol: { label: "SOL", color: "#14f195" },
  btc: { label: "BTC", color: "#f7931a" },
};

export function Watchlist({
  wallets, perWalletUsd, hufFactor, currency, onAdd, onRemove, onRename,
}: {
  wallets: Wallet[];
  perWalletUsd?: Record<string, number>;
  hufFactor: number;
  currency: "usd" | "huf";
  onAdd: (address: string, label: string) => string | undefined; // error v. undefined
  onRemove: (id: string) => void;
  onRename: (id: string, label: string) => void;
}) {
  const [addr, setAddr] = useState("");
  const [label, setLabel] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  const submit = () => {
    const e = onAdd(addr, label);
    if (e) setErr(e);
    else { setErr(null); setAddr(""); setLabel(""); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200">Figyelt tárcák ({wallets.length})</h3>
        <span className="text-[11px] text-slate-500">watch-only · perzisztens (localStorage)</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-3 no-print">
        <input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="Cím: 0x… / SOL base58 / bc1…"
          spellCheck={false} className="flex-1 glass rounded-xl px-3 py-2 text-sm outline-none focus:border-cyan/50 placeholder:text-slate-600" />
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Címke (pl. Fő tárca)"
          className="sm:w-44 glass rounded-xl px-3 py-2 text-sm outline-none focus:border-cyan/50 placeholder:text-slate-600" />
        <button onClick={submit} className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-soft to-cyan text-ink font-semibold text-sm hover:brightness-110 transition">
          Hozzáad
        </button>
      </div>
      {err && <p className="text-xs text-red-400 mb-2">{err}</p>}

      {wallets.length === 0 ? (
        <p className="text-xs text-slate-500">Adj hozzá egy vagy több címet (ETH/SOL/BTC) — mind egy közös portfólióban látszik, valós árfolyamon.</p>
      ) : (
        <div className="space-y-1.5">
          {wallets.map((w) => {
            const t = TYPE_META[w.type];
            const usd = perWalletUsd?.[w.address];
            return (
              <div key={w.id} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-white/[0.04] last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: `${t.color}22`, color: t.color }}>{t.label}</span>
                  {editing === w.id ? (
                    <input autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)}
                      onBlur={() => { onRename(w.id, editVal); setEditing(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { onRename(w.id, editVal); setEditing(null); } }}
                      className="bg-transparent border-b border-cyan/40 text-slate-100 text-sm outline-none w-32" />
                  ) : (
                    <button onClick={() => { setEditing(w.id); setEditVal(w.label); }}
                      className="text-slate-200 font-medium hover:text-cyan-soft transition-colors truncate no-print" title="Átnevezés">
                      {w.label}
                    </button>
                  )}
                  <span className="text-slate-600 text-xs font-mono truncate">{shortAddr(w.address)}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {usd !== undefined && (
                    <span className="text-slate-300">{currency === "usd" ? fmtUsd(usd) : fmtHuf(usd * hufFactor)}</span>
                  )}
                  <button onClick={() => onRemove(w.id)} className="text-slate-600 hover:text-red-400 transition-colors text-xs no-print" title="Törlés">✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
