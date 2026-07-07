import { useState } from "react";
import { motion } from "framer-motion";
import { buildOverview, Overview } from "./lib/compute";
import { fetchPortfolio, resolveInput, Portfolio, CHAINS } from "./lib/multichain";
import { mockOverview } from "./lib/mock";
import { mockPortfolio } from "./lib/mockPortfolio";
import { isEthAddress, shortAddr, fmtDate, monthLabel, fmtEth } from "./lib/format";
import { MetricCard, InfoCard } from "./components/MetricCard";
import { CashflowChart } from "./components/CashflowChart";
import { TxTable } from "./components/TxTable";
import { PortfolioPanel } from "./components/PortfolioPanel";
import { StoryCard, Counterparties, NftGallery, ApprovalsPanel } from "./components/Extras";

const HAS_KEY = !!(import.meta.env.VITE_ETHERSCAN_KEY as string);
const ALL_CHAINS = CHAINS.map((c) => c.id);

const DEMO = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"; // vitalik.eth

export default function App() {
  const [addr, setAddr] = useState("");
  const [data, setData] = useState<Overview | null>(null);
  const [pf, setPf] = useState<Portfolio | null>(null);
  const [ens, setEns] = useState<string | null>(null);
  const [chains, setChains] = useState<string[]>(ALL_CHAINS);
  const [pLoading, setPLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [primary, setPrimary] = useState<"usd" | "huf">("usd"); // domináns pénznem
  const [isMock, setIsMock] = useState(false);

  // Bemenet: egy vagy több cím ÉS/VAGY ENS-név (vessző/szóköz elválasztva).
  const parseInputs = async (raw: string): Promise<string[]> => {
    const parts = raw.split(/[\s,]+/).filter(Boolean);
    const out: string[] = [];
    let firstEns: string | null = null;
    for (const part of parts) {
      const r = await resolveInput(part);
      if (r.address) out.push(r.address.toLowerCase());
      if (r.ens && !firstEns) firstEns = r.ens;
    }
    setEns(firstEns);
    return [...new Set(out)];
  };

  // Multichain portfólió KULCS NÉLKÜL (Blockscout) — a flagship "ingyen" nézet.
  const loadPortfolio = async (addrs: string[]) => {
    setPf(null); setPLoading(true);
    try {
      const p = await fetchPortfolio(addrs, chains);
      // ha minden lánc elhasalt / üres és nincs kulcs → mock, hogy a demó ne legyen üres
      if (p.assetCount === 0 && p.chainErrors.length === chains.length) throw new Error("empty");
      setPf(p);
    } catch {
      if (!HAS_KEY) setPf(mockPortfolio(addrs[0] || DEMO));
    } finally { setPLoading(false); }
  };

  const loadDemo = async () => {
    setError(null); setAddr(DEMO); setEns("vitalik.eth");
    loadPortfolio([DEMO.toLowerCase()]);
    if (HAS_KEY) { run(DEMO); return; }
    setIsMock(true); setData(mockOverview());
  };

  const run = async (value: string) => {
    setIsMock(false); setError(null);
    const addrs = await parseInputs(value);
    if (!addrs.length) { setError("Adj meg legalább egy érvényes ETH-címet vagy ENS-nevet (0x… / …​.eth)."); return; }
    setLoading(true); setData(null);
    loadPortfolio(addrs);
    try {
      setData(await buildOverview(addrs[0])); // aktivitás/gas az első címre
    } catch (e) {
      if (!HAS_KEY) { setIsMock(true); setData(mockOverview()); }
      else setError((e as Error).message || "Hiba a lekérdezésnél.");
    } finally {
      setLoading(false);
    }
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
                <span className="cyan-text">Tárca</span>-áttekintő
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Kripto portfólió-mozgás egy pillantásra — dollárban és forintban.
              </p>
            </div>
            {/* USD/HUF domináns-váltó */}
            <div className="flex items-center gap-1 glass rounded-xl p-1 text-sm">
              {(["usd", "huf"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setPrimary(c)}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    primary === c ? "bg-cyan/20 text-cyan-soft" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {c === "usd" ? "USD elöl" : "HUF elöl"}
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); run(addr); }}
            className="mt-5 flex gap-2 flex-col sm:flex-row"
          >
            <input
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              placeholder="ETH-cím(ek) vagy ENS: 0x… , vitalik.eth (több is, vesszővel)"
              spellCheck={false}
              className="flex-1 glass rounded-xl px-4 py-3 text-sm outline-none focus:border-cyan/50 placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-soft to-cyan text-ink font-semibold text-sm disabled:opacity-50 hover:brightness-110 transition"
            >
              {loading ? "Elemzés…" : "Áttekintés"}
            </button>
            <button
              type="button"
              onClick={loadDemo}
              className="px-4 py-3 rounded-xl glass glass-hover text-sm text-slate-300"
            >
              Demó
            </button>
          </form>

          {/* Lánc-választó (multichain) */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-widest text-slate-500 mr-1">Láncok:</span>
            {CHAINS.map((c) => (
              <button
                key={c.id}
                onClick={() => toggleChain(c.id)}
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
          {isMock && (
            <p className="mt-3 text-xs text-cyan-soft/80">
              A token-portfólió (multichain) VALÓS, kulcs nélkül. Az aktivitás/gas-oldal
              most demó-adat — élő on-chain aktivitáshoz add meg a saját
              <code className="text-cyan-soft"> VITE_ETHERSCAN_KEY</code>-t (ingyenes).
            </p>
          )}
        </header>

        {loading && (
          <div className="text-center text-slate-400 py-20 animate-pulse">
            Tranzakciók és akkori árfolyamok betöltése…
          </div>
        )}

        {(data || pf || pLoading) && !loading && (
          <Result data={data} pf={pf} pLoading={pLoading} ens={ens} primary={primary} />
        )}

        {!data && !pf && !pLoading && !loading && !error && (
          <div className="text-center text-slate-500 py-24 text-sm">
            Írj be egy vagy több ETH-címet / ENS-nevet, vagy nyomd meg a <span className="text-cyan-soft">Demó</span> gombot.
          </div>
        )}

        <footer className="mt-14 pt-6 border-t border-white/5 text-[11px] text-slate-600 leading-relaxed">
          Tájékoztató tárca-áttekintő eszköz — <b>nem adóbevallás</b>. A fiat-váltás tőzsdén történik,
          on-chain nem látszik; az „akkori árfolyam" tájékoztató becslés a CoinGecko napi árfolyamából
          (USD és HUF). A gas-t a tranzakció küldője fizeti. Adat: Etherscan + CoinGecko.
        </footer>
      </div>
    </div>
  );
}

function Result({ data, pf, pLoading, ens, primary }: { data: Overview | null; pf: Portfolio | null; pLoading: boolean; ens: string | null; primary: "usd" | "huf" }) {
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
            {nAddr > 1 ? `${nAddr} tárca összevonva` : "Tárca"}
          </div>
          <div className="text-lg font-semibold font-mono">
            {ens ? <span className="text-cyan-soft">{ens}</span> : shortAddr(headAddr)}
            {ens && <span className="text-slate-500 text-sm ml-2">{shortAddr(headAddr)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {pf && (
            <div className="text-right">
              <div className="text-xs text-slate-400">Portfólió összérték (multichain)</div>
              <div className="text-lg font-semibold cyan-text">
                {cur === "usd" ? `$${Math.round(pf.totalUsd).toLocaleString("en-US")}` : `${Math.round(pf.totalHuf).toLocaleString("hu-HU")} Ft`}
              </div>
            </div>
          )}
          <button onClick={() => window.print()} className="px-3 py-2 rounded-lg text-xs glass glass-hover text-slate-300 no-print">
            PDF / Nyomtatás
          </button>
        </div>
      </motion.div>

      {/* FLAGSHIP — multichain + multi-cím portfólió (kulcs nélkül, valós) */}
      {pf && <PortfolioPanel p={pf} currency={cur} />}
      {!pf && pLoading && (
        <div className="glass rounded-2xl p-5 mb-6 text-sm text-slate-400 animate-pulse">
          Multichain portfólió betöltése (Blockscout, 5 lánc)…
        </div>
      )}

      {/* Aktivitás / gas — Etherscan (kulccsal valós, kulcs nélkül mock) */}
      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <MetricCard
              label="Elégetett gas összesen"
              usd={data.gas.usd} huf={data.gas.huf} primary={cur}
              hero animate sub={`${fmtEth(data.gas.eth)} · a te tranzakcióid díja`}
            />
            <MetricCard label="Beérkezett (ETH, akkori árf.)" usd={data.inflow.usd} huf={data.inflow.huf} primary={cur} animate delay={0.05} />
            <MetricCard label="Kiment (ETH, akkori árf.)" usd={data.outflow.usd} huf={data.outflow.huf} primary={cur} animate delay={0.1} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <InfoCard label="Tranzakciók" value={String(data.txCount)} sub={`${data.tokenTxCount} token-transzfer`} delay={0.05} />
            <InfoCard label="Első tx" value={fmtDate(data.firstTx)} delay={0.1} />
            <InfoCard label="Utolsó tx" value={fmtDate(data.lastTx)} delay={0.15} />
            <InfoCard
              label="Legaktívabb hónap"
              value={data.mostActiveMonth ? monthLabel(data.mostActiveMonth.ym) : "—"}
              sub={data.mostActiveMonth ? `${data.mostActiveMonth.count} tx` : undefined}
              delay={0.2}
            />
          </div>

          <StoryCard ov={data} currency={cur} />

          <div className="glass rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-200">Havi ETH-cashflow ({cur.toUpperCase()})</h3>
              <div className="flex gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-cyan inline-block" /> Beérkezett</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-500 inline-block" /> Kiment</span>
              </div>
            </div>
            <CashflowChart data={data.monthly} currency={cur} />
          </div>

          <Counterparties ov={data} />
        </>
      )}

      {/* NFT-galéria (kulcs nélkül, valós) */}
      {pf && <NftGallery nfts={pf.nfts.map((n) => ({ collection: n.collection, tokenId: n.tokenId, image: n.image }))} total={pf.nftCount} />}

      {/* Aktivitás tx-tábla */}
      {data && <TxTable rows={data.txRows} currency={cur} />}

      {/* Approvals biztonsági panel — valós revoke.cash deep-link (nincs fake adat) */}
      {headAddr && <div className="mt-6"><ApprovalsPanel address={headAddr} /></div>}
    </div>
  );
}
