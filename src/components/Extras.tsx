import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Overview } from "../lib/compute";
import { fmtUsd, fmtHuf, fmtDate, monthLabel, shortAddr } from "../lib/format";
import { fetchApprovals, fmtApprovalAmount, ApprovalsResult } from "../lib/approvals";
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

// B3: Approvals biztonsági panel — VALÓS in-app ERC-20 allowance-lista, kulcs nélkül
// (Blockscout Approval-event logok, 6 lánc), + revoke.cash deep-link a visszavonáshoz.
// Az összegek a LEGUTÓBBI Approval eventből jönnek (a már elköltött keret nincs
// levonva) — ezt a UI őszintén jelzi; kitalált adat itt sincs.
export function ApprovalsPanel({ address }: { address: string }) {
  const t = useT();
  const [res, setRes] = useState<ApprovalsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRes(null); setFailed(false); setLoading(true);
    fetchApprovals(address)
      .then((r) => { if (!cancelled) setRes(r); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [address]);

  const allErrored = res && res.erroredChains.length > 0 && res.approvals.length === 0 && res.erroredChains.length >= 6;
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-5 mb-6 border-l-2 border-cyan/40">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <h3 className="text-sm font-semibold text-slate-200">
          {t("approvals.title")} <span className="text-slate-500 font-normal font-mono text-xs ml-1">{shortAddr(address)}</span>
        </h3>
        {res && res.approvals.length > 0 && (
          <span className="text-xs text-amber-400/80">{t("approvals.count", { n: res.approvals.length })}</span>
        )}
      </div>
      <p className="text-xs text-slate-400 leading-relaxed mb-3">{t("approvals.body")}</p>

      {loading && <p className="text-xs text-slate-500 animate-pulse mb-3">{t("approvals.loading")}</p>}
      {(failed || allErrored) && <p className="text-xs text-amber-400/80 mb-3">{t("approvals.unavailable")}</p>}
      {res && !loading && !failed && !allErrored && res.approvals.length === 0 && (
        <p className="text-xs text-emerald-400/80 mb-3">{t("approvals.none")}</p>
      )}

      {res && res.approvals.length > 0 && (
        <div className="overflow-x-auto mb-3 max-h-72 overflow-y-auto pr-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-white/5">
                <th className="py-2 pr-3 font-medium">{t("approvals.colToken")}</th>
                <th className="py-2 pr-3 font-medium">{t("approvals.colSpender")}</th>
                <th className="py-2 pr-3 font-medium text-right">{t("approvals.colAmount")}</th>
                <th className="py-2 font-medium text-right">{t("approvals.colDate")}</th>
              </tr>
            </thead>
            <tbody>
              {res.approvals.slice(0, 40).map((a) => (
                <tr key={`${a.chain}:${a.token}:${a.spender}`} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="py-2 pr-3">
                    <span className="text-slate-200 font-medium">{a.tokenSymbol}</span>
                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${a.chainColor}22`, color: a.chainColor }}>{a.chainName}</span>
                  </td>
                  <td className="py-2 pr-3">
                    <a href={`${a.explorerBase}/address/${a.spender}`} target="_blank" rel="noopener noreferrer"
                      className="font-mono text-slate-400 hover:text-cyan-soft transition-colors text-xs">{shortAddr(a.spender)}</a>
                  </td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap">
                    {a.unlimited
                      ? <span className="text-red-400/90 font-semibold" title={t("approvals.unlimitedTip")}>{t("approvals.unlimited")}</span>
                      : <span className="text-slate-300">{fmtApprovalAmount(a)}</span>}
                  </td>
                  <td className="py-2 text-right text-slate-500 text-xs whitespace-nowrap">{fmtDate(a.timeStamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {res.approvals.length > 40 && (
            <p className="text-[11px] text-slate-500 mt-2 text-center">{t("approvals.moreRows", { n: res.approvals.length })}</p>
          )}
        </div>
      )}

      {res && res.approvals.length > 0 && (
        <p className="text-[11px] text-slate-500 mb-2">{t("approvals.eventNote")}</p>
      )}
      {res && res.truncatedChains.length > 0 && (
        <p className="text-[11px] text-amber-400/70 mb-2">{t("approvals.truncated", { chains: res.truncatedChains.join(", ") })}</p>
      )}
      {res && !allErrored && res.erroredChains.length > 0 && (
        <p className="text-[11px] text-amber-400/70 mb-2">{t("approvals.chainsErrored", { chains: res.erroredChains.join(", ") })}</p>
      )}

      <a href={`https://revoke.cash/address/${address}`} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-gradient-to-r from-cyan-soft to-cyan text-ink font-semibold hover:brightness-110 transition no-print">
        {t("approvals.cta")}
      </a>
    </motion.div>
  );
}
