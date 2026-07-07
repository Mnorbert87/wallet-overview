import { useState } from "react";
import { motion } from "framer-motion";
import { buildOverview, Overview } from "./lib/compute";
import { fetchHoldings, HoldingsResult } from "./lib/holdings";
import { mockOverview } from "./lib/mock";
import { isEthAddress, shortAddr, fmtDate, monthLabel, fmtEth } from "./lib/format";
import { MetricCard, InfoCard } from "./components/MetricCard";
import { CashflowChart } from "./components/CashflowChart";
import { TxTable } from "./components/TxTable";
import { HoldingsPanel } from "./components/HoldingsPanel";
import { StoryCard, Counterparties, NftGallery, ApprovalsNotice } from "./components/Extras";

const HAS_KEY = !!(import.meta.env.VITE_ETHERSCAN_KEY as string);

const DEMO = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"; // vitalik.eth

export default function App() {
  const [addr, setAddr] = useState("");
  const [data, setData] = useState<Overview | null>(null);
  const [holdings, setHoldings] = useState<HoldingsResult | null>(null);
  const [hErr, setHErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [primary, setPrimary] = useState<"usd" | "huf">("usd"); // domináns pénznem
  const [isMock, setIsMock] = useState(false);

  // A token-holdings KULCS NÉLKÜL jön (Blockscout) — mindig valós, akkor is ha
  // az aktivitás-oldal (Etherscan) mockra esik.
  const loadHoldings = async (a: string) => {
    setHoldings(null); setHErr(null);
    try { setHoldings(await fetchHoldings(a)); }
    catch (e) { setHErr((e as Error).message || "holdings betöltési hiba"); }
  };

  const loadDemo = () => {
    setError(null); setAddr(DEMO);
    loadHoldings(DEMO); // valós holdings kulcs nélkül is
    if (HAS_KEY) { run(DEMO); return; }
    setIsMock(true); setData(mockOverview());
  };

  const run = async (value: string) => {
    setIsMock(false);
    const a = value.trim();
    if (!isEthAddress(a)) { setError("Adj meg egy érvényes ETH-címet (0x…40 hex)."); return; }
    setError(null); setLoading(true); setData(null);
    loadHoldings(a);
    try {
      setData(await buildOverview(a));
    } catch (e) {
      // Az aktivitás-oldal (Etherscan) elhasalt, de a holdings kulcs nélkül megvan.
      if (!HAS_KEY) { setIsMock(true); setData(mockOverview()); }
      else setError((e as Error).message || "Hiba a lekérdezésnél.");
    } finally {
      setLoading(false);
    }
  };

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
              placeholder="ETH-cím: 0x…"
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
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          {isMock && (
            <p className="mt-3 text-xs text-cyan-soft/80">
              MOCK adat (nincs Etherscan-kulcs) — a UI/számítás teljes; élő lánc-adathoz
              állítsd be a <code className="text-cyan-soft">VITE_ETHERSCAN_KEY</code>-t.
            </p>
          )}
        </header>

        {loading && (
          <div className="text-center text-slate-400 py-20 animate-pulse">
            Tranzakciók és akkori árfolyamok betöltése…
          </div>
        )}

        {(data || holdings) && !loading && (
          <Result data={data} holdings={holdings} hErr={hErr} primary={primary} />
        )}

        {!data && !loading && !error && (
          <div className="text-center text-slate-500 py-24 text-sm">
            Írj be egy ETH-címet, vagy nyomd meg a <span className="text-cyan-soft">Demó</span> gombot.
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

function Result({ data, holdings, hErr, primary }: { data: Overview | null; holdings: HoldingsResult | null; hErr: string | null; primary: "usd" | "huf" }) {
  const cur = primary;
  const headAddr = data?.address || holdings?.address || "";
  return (
    <div>
      {/* Tárca-fejléc */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-5 mb-5 flex items-center justify-between gap-4 flex-wrap"
      >
        <div>
          <div className="text-xs uppercase tracking-widest text-cyan-soft/70">Tárca</div>
          <div className="text-lg font-semibold font-mono">{shortAddr(headAddr)}</div>
        </div>
        {holdings && (
          <div className="text-right">
            <div className="text-xs text-slate-400">Portfólió összérték</div>
            <div className="text-lg font-semibold cyan-text">
              {cur === "usd" ? `$${Math.round(holdings.totalUsd).toLocaleString("en-US")}` : `${Math.round(holdings.totalHuf).toLocaleString("hu-HU")} Ft`}
            </div>
          </div>
        )}
      </motion.div>

      {/* PRIORITÁS 1 — teljes token-holdings (kulcs nélkül, valós) */}
      {holdings && <HoldingsPanel data={holdings} currency={cur} />}
      {!holdings && (
        <div className="glass rounded-2xl p-5 mb-6 text-sm text-slate-400">
          {hErr ? `Token-portfólió: ${hErr}` : "Token-portfólió betöltése (Blockscout)…"}
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
      {holdings && <NftGallery nfts={holdings.nfts} total={holdings.nftCount} />}

      {/* Aktivitás tx-tábla */}
      {data && <TxTable rows={data.txRows} currency={cur} />}

      {/* Approvals — őszinte 3.-körös jelzés (nincs fake adat) */}
      <div className="mt-6"><ApprovalsNotice /></div>
    </div>
  );
}
