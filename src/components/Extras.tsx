import { motion } from "framer-motion";
import { Overview } from "../lib/compute";
import { fmtUsd, fmtHuf, fmtDate, monthLabel, shortAddr } from "../lib/format";
import { useT } from "../lib/i18n";

// A3: a régi single-chain holdings.ts kivezetve (multichain.ts/aggregate.ts váltotta ki);
// a galériának csak ez a minimál-típus kell.
export interface NftItem { collection: string; tokenId: string; image: string | null; }

// „A tárcád története" — megosztható narratíva a meglévő adatból (mock+élő).
export function StoryCard({ ov, currency, isMock = false }: { ov: Overview; currency: "usd" | "huf"; isMock?: boolean }) {
  const t = useT();
  const fmt = currency === "usd" ? fmtUsd : fmtHuf;
  const gas = currency === "usd" ? ov.gas.usd : ov.gas.huf;
  const inflow = currency === "usd" ? ov.inflow.usd : ov.inflow.huf;
  const years = ((ov.lastTx - ov.firstTx) / (365 * 86400)).toFixed(1);
  // #11 i18n + #3: a body sablon <b>-taggekkel; mock esetén a footer NEM állítja valósnak.
  let body = t("story.body", { date: fmtDate(ov.firstTx), years, tx: ov.txCount, gas: fmt(gas), inflow: fmt(inflow) });
  if (ov.mostActiveMonth) body += " " + t("story.activeMonth", { month: monthLabel(ov.mostActiveMonth.ym), count: ov.mostActiveMonth.count });
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-6 mb-6 relative overflow-hidden">
      <div aria-hidden className="absolute -right-10 -top-10 w-40 h-40 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(34,211,238,0.18), transparent 70%)" }} />
      <h3 className="text-sm font-semibold text-cyan-soft mb-3 uppercase tracking-widest">{t("story.title")}</h3>
      <p className="text-lg leading-relaxed text-slate-200 max-w-2xl" dangerouslySetInnerHTML={{ __html: body }} />
      <p className="text-xs text-slate-500 mt-3">{isMock ? t("story.shareSample") : t("story.shareReal")}</p>
    </motion.div>
  );
}

export function Counterparties({ ov }: { ov: Overview }) {
  const t = useT();
  if (!ov.counterparties.length) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 mb-6">
      <h3 className="text-sm font-semibold text-slate-200 mb-3">{t("cp.title")}</h3>
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
  const t = useT();
  if (!nfts.length) return null;
  // FORGE FIX #4 (2026-07-07): a galéria GÖRGETHETŐ — 150+ NFT-nél eddig csak a
  // felső sorok látszottak (nem volt scroll-wrapper). max-height + overflow-y:auto
  // + lazy-load, hogy MINDEN NFT elérhető legyen. A "{látszik}/{összes}" jelzi, ha
  // a teljes készletnek csak egy része töltődött be (a data-réteg felső korlátja).
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 mb-6">
      <h3 className="text-sm font-semibold text-slate-200 mb-3">
        {t("nft.title")} <span className="text-slate-500 font-normal">({t("nft.count", { n: total })}{nfts.length < total ? ` · ${nfts.length}` : ""})</span>
      </h3>
      <div className="max-h-[440px] overflow-y-auto pr-1 -mr-1">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {nfts.map((n, i) => (
            <div key={i} className="aspect-square rounded-xl overflow-hidden bg-white/5 border border-cyan/10 flex items-center justify-center">
              {n.image ? (
                <img src={n.image} alt={n.collection} loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <div className="text-[10px] text-slate-500 text-center px-1 leading-tight break-words">{n.collection}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// Approvals biztonsági panel — VALÓS, egy-kattintásos revoke.cash deep-link a
// cím token-engedélyeinek ellenőrzésére/visszavonására. A revoke.cash a vezető
// ingyenes eszköz erre; a cím elő van töltve. (A teljes IN-APP allowance-lista
// Approval-event logokat/RPC-t igényel — az a 4. kör; itt semmi fake nincs.)
export function ApprovalsPanel({ address }: { address: string }) {
  const t = useT();
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-5 mb-6 border-l-2 border-cyan/40">
      <h3 className="text-sm font-semibold text-slate-200 mb-1">{t("approvals.title")}</h3>
      <p className="text-xs text-slate-400 leading-relaxed mb-3">{t("approvals.body")}</p>
      <a href={`https://revoke.cash/address/${address}`} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-gradient-to-r from-cyan-soft to-cyan text-ink font-semibold hover:brightness-110 transition no-print">
        {t("approvals.cta")}
      </a>
    </motion.div>
  );
}
