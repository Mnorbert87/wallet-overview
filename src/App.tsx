import { useState } from "react";
import { motion } from "framer-motion";
import { buildOverview, Overview } from "./lib/compute";
import { mockOverview } from "./lib/mock";
import { isEthAddress, shortAddr, fmtDate, monthLabel, fmtEth } from "./lib/format";

const HAS_KEY = !!(import.meta.env.VITE_ETHERSCAN_KEY as string);
import { MetricCard, InfoCard } from "./components/MetricCard";
import { CashflowChart } from "./components/CashflowChart";
import { TxTable } from "./components/TxTable";

const DEMO = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"; // vitalik.eth

export default function App() {
  const [addr, setAddr] = useState("");
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [primary, setPrimary] = useState<"usd" | "huf">("usd"); // domináns pénznem
  const [isMock, setIsMock] = useState(false);

  const loadDemo = () => {
    setError(null);
    if (HAS_KEY) { setAddr(DEMO); run(DEMO); return; }
    // Kulcs nélkül: beépített mock, hogy a dashboard teljes egészében látszódjon.
    setIsMock(true); setAddr(DEMO); setData(mockOverview());
  };

  const run = async (value: string) => {
    setIsMock(false);
    const a = value.trim();
    if (!isEthAddress(a)) { setError("Adj meg egy érvényes ETH-címet (0x…40 hex)."); return; }
    setError(null); setLoading(true); setData(null);
    try {
      setData(await buildOverview(a));
    } catch (e) {
      setError((e as Error).message || "Hiba a lekérdezésnél.");
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

        {data && !loading && <Result data={data} primary={primary} />}

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

function Result({ data, primary }: { data: Overview; primary: "usd" | "huf" }) {
  const cur = primary;
  return (
    <div>
      {/* Tárca-fejléc */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-5 mb-5 flex items-center justify-between gap-4 flex-wrap"
      >
        <div>
          <div className="text-xs uppercase tracking-widest text-cyan-soft/70">Tárca</div>
          <div className="text-lg font-semibold font-mono">{shortAddr(data.address)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400">Becsült ETH-egyenleg (net mozgás)</div>
          <div className="text-lg font-semibold">{fmtEth(Math.max(0, data.balanceEth))}</div>
        </div>
      </motion.div>

      {/* Metrika-kártyák — mind USD + HUF */}
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

      {/* Cashflow-grafikon */}
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

      {/* Tx-tábla */}
      <TxTable rows={data.txRows} currency={cur} />

      {data.tokenSymbols.length > 0 && (
        <div className="mt-5 glass rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Érintett tokenek</h3>
          <div className="flex flex-wrap gap-2">
            {data.tokenSymbols.map((s) => (
              <span key={s} className="px-3 py-1 rounded-lg text-xs bg-white/5 border border-cyan/15 text-slate-300">{s}</span>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3">
            A token-értékek USD/HUF árazása a 2. körben jön (per-token árfolyam); most a mennyiség és a darab látszik.
          </p>
        </div>
      )}
    </div>
  );
}
