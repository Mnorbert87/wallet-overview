import { motion } from "framer-motion";
import { Overview } from "../lib/compute";
import { HoldingsResult, NftItem } from "../lib/holdings";
import { fmtUsd, fmtHuf, fmtDate, monthLabel, shortAddr } from "../lib/format";

// „A tárcád története" — megosztható narratíva a meglévő adatból (mock+élő).
export function StoryCard({ ov, currency }: { ov: Overview; currency: "usd" | "huf" }) {
  const fmt = currency === "usd" ? fmtUsd : fmtHuf;
  const gas = currency === "usd" ? ov.gas.usd : ov.gas.huf;
  const inflow = currency === "usd" ? ov.inflow.usd : ov.inflow.huf;
  const years = ((ov.lastTx - ov.firstTx) / (365 * 86400)).toFixed(1);
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-6 mb-6 relative overflow-hidden">
      <div aria-hidden className="absolute -right-10 -top-10 w-40 h-40 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(34,211,238,0.18), transparent 70%)" }} />
      <h3 className="text-sm font-semibold text-cyan-soft mb-3 uppercase tracking-widest">A tárcád története</h3>
      <p className="text-lg leading-relaxed text-slate-200 max-w-2xl">
        Ez a tárca <b className="text-white">{fmtDate(ov.firstTx)}</b> óta él — közel{" "}
        <b className="text-white">{years} éve</b>. Azóta <b className="text-white">{ov.txCount}</b> tranzakciót
        indított, összesen <b className="cyan-text">{fmt(gas)}</b>-t fizetett gas-ban, és{" "}
        <b className="text-white">{fmt(inflow)}</b> értékű ETH érkezett be az akkori árfolyamokon.
        {ov.mostActiveMonth && <> A legaktívabb hónap <b className="text-white">{monthLabel(ov.mostActiveMonth.ym)}</b> volt
          ({ov.mostActiveMonth.count} tx).</>}
      </p>
      <p className="text-xs text-slate-500 mt-3">
        Oszd meg egy képernyőképpel — a számok a valós on-chain aktivitásból származnak.
      </p>
    </motion.div>
  );
}

export function Counterparties({ ov }: { ov: Overview }) {
  if (!ov.counterparties.length) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 mb-6">
      <h3 className="text-sm font-semibold text-slate-200 mb-3">Leggyakoribb partnerek</h3>
      <div className="space-y-1.5">
        {ov.counterparties.map((c) => (
          <div key={c.address} className="flex items-center justify-between text-sm">
            <a href={`https://etherscan.io/address/${c.address}`} target="_blank" rel="noopener noreferrer"
              className="font-mono text-slate-300 hover:text-cyan-soft transition-colors">{shortAddr(c.address)}</a>
            <span className="text-slate-500">{c.count} tx</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export function NftGallery({ nfts, total }: { nfts: NftItem[]; total: number }) {
  if (!nfts.length) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 mb-6">
      <h3 className="text-sm font-semibold text-slate-200 mb-3">NFT-k ({total})</h3>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {nfts.map((n, i) => (
          <div key={i} className="aspect-square rounded-xl overflow-hidden bg-white/5 border border-cyan/10 flex items-center justify-center">
            {n.image ? (
              <img src={n.image} alt={n.collection} loading="lazy" className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <div className="text-[10px] text-slate-500 text-center px-1 leading-tight">{n.collection}</div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// Approvals — ŐSZINTE placeholder: valós allowance-adat Etherscan Approval-event
// logokat (kulcs) v. RPC-t igényel; NEM fake-elünk semmit.
export function ApprovalsNotice() {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-5 mb-6 border-l-2 border-amber-400/40">
      <h3 className="text-sm font-semibold text-slate-200 mb-1">Biztonsági approvals-panel</h3>
      <p className="text-xs text-slate-400 leading-relaxed">
        Az aktív ERC-20 allowance-ok (mit engedélyeztél és kinek) + egy-kattintásos visszavonás a
        <b className="text-slate-300"> 3. körben</b> jön: valós allowance-adat Etherscan Approval-event
        logokat (API-kulcs) vagy egy RPC-multicall-t igényel — kulcs nélkül NEM megjeleníthető adat, ezért
        itt nem mutatunk kitalált értéket. A revoke-deep-link a <span className="text-cyan-soft">revoke.cash</span>-re
        mutat majd.
      </p>
    </motion.div>
  );
}
