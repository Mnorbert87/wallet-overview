import { useState, useEffect, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { buildOverview, Overview } from "./lib/compute";
import { resolveInput, Portfolio, CHAINS } from "./lib/multichain";
import { fetchWatchlist } from "./lib/aggregate";
import { Wallet, loadWallets, addWallet, removeWallet, renameWallet } from "./lib/wallets";
import { mockOverview } from "./lib/mock";
import { shortAddr, fmtDate, monthLabel, fmtEth } from "./lib/format";
import { MetricCard, InfoCard } from "./components/MetricCard";
import { TxTable } from "./components/TxTable";
import { Watchlist } from "./components/Watchlist";
// #WO-5: a recharts-nehéz paneleket lazy-töltjük → a ~534KB charts-chunk NEM az első
// festés kritikus útján van (Suspense fallback azonnal látszik, a lista alatt tölt).
const CashflowChart = lazy(() => import("./components/CashflowChart").then((m) => ({ default: m.CashflowChart })));
const PortfolioPanel = lazy(() => import("./components/PortfolioPanel").then((m) => ({ default: m.PortfolioPanel })));
import { StoryCard, Counterparties, NftGallery, ApprovalsPanel } from "./components/Extras";
import { useT, useLang, setLang, EN_ONLY, Lang } from "./lib/i18n";

function LanguageToggle() {
  const lang = useLang();
  if (EN_ONLY) return null; // publikus build: EN-only, nincs toggle
  return (
    <div className="flex items-center gap-1 glass rounded-xl p-1 text-sm">
      {(["hu", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`px-3 py-1.5 rounded-lg transition-colors uppercase ${
            lang === l ? "bg-cyan/20 text-cyan-soft" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

const HAS_KEY = !!(import.meta.env.VITE_ETHERSCAN_KEY as string);
const ALL_CHAINS = CHAINS.map((c) => c.id);

const DEMO = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"; // vitalik.eth
const DEMO_SOL = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const DEMO_BTC = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"; // szerény, valós, aktív cím (~0.2 BTC) — nem whale, hogy a demo első benyomása épeszű total legyen

export default function App() {
  const t = useT();
  const [addr, setAddr] = useState("");
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [data, setData] = useState<Overview | null>(null);
  const [pf, setPf] = useState<Portfolio | null>(null);
  const [ens, setEns] = useState<string | null>(null);
  const [chains, setChains] = useState<string[]>(ALL_CHAINS);
  const [pLoading, setPLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [primary, setPrimary] = useState<"usd" | "huf">("usd"); // domináns pénznem
  const [isMock, setIsMock] = useState(false);
  const [pfError, setPfError] = useState(false); // portfólió-adatforrás nem elérhető

  // Perzisztens watchlist betöltése induláskor.
  useEffect(() => { setWallets(loadWallets()); }, []);

  // Az összevont portfólió a figyelt tárcákból (EVM+SOL+BTC), amikor a lista v.
  // a lánc-szűrő változik. Watch-only, keyless.
  useEffect(() => {
    if (!wallets.length) { setPf(null); return; }
    let cancelled = false;
    setPLoading(true);
    // SHIP-BLOCKER FIX (#1/#2): SOHA nem fabrikálunk mock-totált valós címhez.
    // Üres tárca = valid $0 (a valós, üres portfóliót mutatjuk). Fetch-hiba =
    // "adatforrás nem elérhető" banner, NEM kitalált hatszámjegyű total.
    fetchWatchlist(wallets, chains)
      .then((p) => { if (!cancelled) { setPf(p); setPfError(false); } })
      .catch(() => { if (!cancelled) { setPf(null); setPfError(true); } })
      .finally(() => { if (!cancelled) setPLoading(false); });
    return () => { cancelled = true; };
  }, [wallets, chains]);

  // Az aktivitás/gas oldal az első EVM tárcára (Etherscan; kulcs nélkül mock).
  useEffect(() => {
    const firstEvm = wallets.find((w) => w.type === "evm");
    if (!firstEvm) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    buildOverview(firstEvm.address)
      .then((d) => { if (!cancelled) { setData(d); setIsMock(false); } })
      .catch(() => { if (!cancelled && !HAS_KEY) { setData(mockOverview()); setIsMock(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [wallets]);

  // Cím(ek)/ENS hozzáadása a watchlisthez (a fő input és a Demó ezt hívja).
  const addToWatchlist = (rawAddr: string, label: string): string | undefined => {
    const { list, error: e } = addWallet(wallets, rawAddr, label);
    if (e) return t(e); // #WO-3: addWallet i18n-kulcsot ad → itt fordítjuk
    setWallets(list);
  };

  const run = async () => {
    setError(null);
    const parts = addr.split(/[\s,]+/).filter(Boolean);
    if (!parts.length) { setError(t("err.needAddress")); return; }
    let added = 0, lastErr: string | undefined;
    let cur = wallets;
    for (const part of parts) {
      const r = await resolveInput(part); // ENS → cím
      const use = r.address || part;
      const { list, error: e } = addWallet(cur, use, r.ens || "");
      if (e) lastErr = e; else { cur = list; added++; }
    }
    setWallets(cur);
    if (added) setAddr("");
    else if (lastErr) setError(t(lastErr)); // #WO-3: i18n-kulcs → fordítás
  };

  const loadDemo = () => {
    setError(null);
    let cur = wallets;
    for (const [a, l] of [[DEMO, "Vitalik (EVM)"], [DEMO_SOL, "Demo Solana"], [DEMO_BTC, "Demo Bitcoin"]] as [string, string][]) {
      const { list } = addWallet(cur, a, l);
      cur = list;
    }
    setWallets(cur); setEns(null);
  };

  const toggleChain = (id: string) =>
    setChains((cs) => (cs.includes(id) ? cs.filter((c) => c !== id) : [...cs, id]));

  return (
    <div className="min-h-full">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Fejléc + kereső */}
        <header className="mb-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">
                <span className="cyan-text">{t("app.title")}</span>
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">{t("app.subtitle")}</p>
            </div>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              {/* USD/HUF domináns-váltó */}
              <div className="flex items-center gap-1 glass rounded-xl p-1 text-sm">
                {(["usd", "huf"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setPrimary(c)}
                    aria-pressed={primary === c}
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      primary === c ? "bg-cyan/20 text-cyan-soft" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {c === "usd" ? t("cur.usdFirst") : t("cur.hufFirst")}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); run(); }}
            className="mt-5 flex gap-2 flex-col sm:flex-row"
          >
            <input
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              placeholder={t("search.placeholder")}
              aria-label={t("search.placeholder")}
              spellCheck={false}
              className="flex-1 glass rounded-xl px-4 py-3 text-sm outline-none focus:border-cyan/50 placeholder:text-slate-500"
            />
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-soft to-cyan text-ink font-semibold text-sm hover:brightness-110 transition"
            >
              {t("btn.add")}
            </button>
            <button
              type="button"
              onClick={loadDemo}
              className="px-4 py-3 rounded-xl glass glass-hover text-sm text-slate-300"
            >
              {t("btn.demo")}
            </button>
          </form>

          {/* Lánc-választó (multichain) */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-widest text-slate-500 mr-1">{t("label.chains")}</span>
            {CHAINS.map((c) => (
              <button
                key={c.id}
                onClick={() => toggleChain(c.id)}
                aria-pressed={chains.includes(c.id)}
                className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                  chains.includes(c.id) ? "text-white" : "text-slate-500 border-transparent"
                }`}
                style={chains.includes(c.id) ? { background: `${c.color}22`, borderColor: `${c.color}66` } : {}}
              >
                {c.name}
              </button>
            ))}
          </div>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          {pfError && wallets.length > 0 && (
            <p className="mt-3 text-sm text-amber-400/90">{t("pf.sourceUnavailable")}</p>
          )}
          {isMock && (
            <p className="mt-3 text-xs text-cyan-soft/80">{t("mock.notice")}</p>
          )}
        </header>

        {/* Figyelt tárcák — mindig látható, perzisztens */}
        <Watchlist
          wallets={wallets}
          perWalletUsd={pf?.perWalletUsd}
          walletsWithAssets={pf?.walletsWithAssets}
          walletsErrored={pf?.walletsErrored}
          hufFactor={pf?.usdHufFactor ?? 372}
          currency={primary}
          onAdd={addToWatchlist}
          onRemove={(id) => setWallets((w) => removeWallet(w, id))}
          onRename={(id, label) => setWallets((w) => renameWallet(w, id, label))}
        />

        {(data || pf || pLoading) && (
          <Result data={data} pf={pf} pLoading={pLoading} ens={ens} primary={primary} isMock={isMock} />
        )}

        {!wallets.length && !pLoading && (
          <div className="text-center text-slate-500 py-16 text-sm">{t("empty.addWallets")}</div>
        )}

        <footer className="mt-14 pt-6 border-t border-white/5 text-[11px] text-slate-600 leading-relaxed">
          {t("footer.disclaimer")}
        </footer>
      </div>
    </div>
  );
}

function Result({ data, pf, pLoading, ens, primary, isMock }: { data: Overview | null; pf: Portfolio | null; pLoading: boolean; ens: string | null; primary: "usd" | "huf"; isMock: boolean }) {
  const t = useT();
  const cur = primary;
  const headAddr = pf?.addresses[0] || data?.address || "";
  const nAddr = pf?.addresses.length || 1;
  return (
    <div>
      {/* Tárca-fejléc */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-5 mb-5 flex items-center justify-between gap-4 flex-wrap"
      >
        <div>
          <div className="text-xs uppercase tracking-widest text-cyan-soft/70">
            {nAddr > 1 ? t("res.walletsMerged", { n: nAddr }) : t("res.wallet")}
          </div>
          <div className="text-lg font-semibold font-mono">
            {ens ? <span className="text-cyan-soft">{ens}</span> : shortAddr(headAddr)}
            {ens && <span className="text-slate-500 text-sm ml-2">{shortAddr(headAddr)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {pf && (
            <div className="text-right">
              <div className="text-xs text-slate-400">{t("res.totalValue")}</div>
              <div className="text-lg font-semibold cyan-text">
                {cur === "usd" ? `$${Math.round(pf.totalUsd).toLocaleString("en-US")}` : `${Math.round(pf.totalHuf).toLocaleString("hu-HU")} Ft`}
              </div>
            </div>
          )}
          <button onClick={() => window.print()} className="px-3 py-2 rounded-lg text-xs glass glass-hover text-slate-300 no-print">
            {t("btn.print")}
          </button>
        </div>
      </motion.div>

      {/* NATIVE-CAP jelzés: valós, de szokatlanul nagy native-egyenleg a totálban —
          nem fabrikált (nem mock), de nem is jelöletlen milliárdos "igazság". */}
      {pf && pf.oversizedNativeUsd > 0 && (
        <div className="glass rounded-xl p-3 mb-5 text-xs text-amber-300/90 border-l-2 border-amber-400/60">
          {t("pf.oversizedNative", {
            v: cur === "usd"
              ? `$${Math.round(pf.oversizedNativeUsd).toLocaleString("en-US")}`
              : `${Math.round(pf.oversizedNativeUsd * (pf.usdHufFactor || 372)).toLocaleString("hu-HU")} Ft`,
          })}
        </div>
      )}

      {/* FLAGSHIP — multichain + multi-cím portfólió (kulcs nélkül, valós) */}
      {pf && (
        <Suspense fallback={<div className="glass rounded-2xl p-5 mb-6 text-sm text-slate-400 animate-pulse">{t("pf.loading")}</div>}>
          <PortfolioPanel p={pf} currency={cur} />
        </Suspense>
      )}
      {!pf && pLoading && (
        <div className="glass rounded-2xl p-5 mb-6 text-sm text-slate-400 animate-pulse">
          {t("pf.loading")}
        </div>
      )}

      {/* Aktivitás / gas — Etherscan (kulccsal valós, kulcs nélkül mock) */}
      {data && (
        <>
          {data.priceDegraded && (
            <div className="glass rounded-xl p-3 mb-5 text-xs text-amber-400/90 border-l-2 border-amber-400/50">
              {t("price.degraded")}
            </div>
          )}
          {data.txTruncated && (
            <div className="glass rounded-xl p-3 mb-5 text-xs text-amber-400/90 border-l-2 border-amber-400/60">
              {t("tx.truncatedActivity")}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <MetricCard
              label={t("metric.gasBurned")}
              usd={data.gas.usd} huf={data.gas.huf} primary={cur}
              hero animate sub={`${fmtEth(data.gas.eth)} · ${t("metric.gasSub")}`}
            />
            <MetricCard label={t("metric.inflow")} usd={data.inflow.usd} huf={data.inflow.huf} primary={cur} animate delay={0.05} />
            <MetricCard label={t("metric.outflow")} usd={data.outflow.usd} huf={data.outflow.huf} primary={cur} animate delay={0.1} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <InfoCard label={t("metric.txs")} value={String(data.txCount)} sub={t("metric.tokenTransfers", { n: data.tokenTxCount })} delay={0.05} />
            <InfoCard label={t("metric.firstTx")} value={fmtDate(data.firstTx)} delay={0.1} />
            <InfoCard label={t("metric.lastTx")} value={fmtDate(data.lastTx)} delay={0.15} />
            <InfoCard
              label={t("metric.mostActive")}
              value={data.mostActiveMonth ? monthLabel(data.mostActiveMonth.ym) : "—"}
              sub={data.mostActiveMonth ? `${data.mostActiveMonth.count} tx` : undefined}
              delay={0.2}
            />
          </div>

          <StoryCard ov={data} currency={cur} isMock={isMock} />

          <div className="glass rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-200">{t("cf.title", { cur: cur.toUpperCase() })}</h3>
              <div className="flex gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-cyan inline-block" /> {t("cf.received")}</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-500 inline-block" /> {t("cf.sent")}</span>
              </div>
            </div>
            <Suspense fallback={<div className="h-48 animate-pulse" />}>
              <CashflowChart data={data.monthly} currency={cur} />
            </Suspense>
          </div>

          <Counterparties ov={data} />
        </>
      )}

      {/* NFT-galéria (kulcs nélkül, valós) */}
      {pf && <NftGallery nfts={pf.nfts.map((n) => ({ collection: n.collection, tokenId: n.tokenId, image: n.image }))} total={pf.nftCount} />}

      {/* Aktivitás tx-tábla */}
      {data && <TxTable rows={data.txRows} currency={cur} address={data.address} />}

      {/* Approvals biztonsági panel — valós revoke.cash deep-link (nincs fake adat) */}
      {headAddr && <div className="mt-6"><ApprovalsPanel address={headAddr} /></div>}
    </div>
  );
}
