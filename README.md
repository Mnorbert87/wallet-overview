# Tárca-áttekintő (wallet-overview) — MVP

Kripto tárca **portfólió-mozgás** eszköz — ETH-cím beírása → tranzakció-összegzés,
be/ki cashflow, és az **elégetett gas** — minden érték **dollárban ÉS forintban**,
az akkori napi árfolyamon. Dark prémium, cián akcentus, single-page.

> **Nem adóbevallás.** A fiat-váltás tőzsdén történik, on-chain nem látszik; az
> „akkori árfolyam" tájékoztató becslés (CoinGecko napi USD+HUF).

## Stack
React + Vite + TypeScript + Tailwind + Recharts + framer-motion. Adat: Etherscan
V2 (lánc) + CoinGecko (USD+HUF napi ár).

## Helyi futtatás

```bash
cd wallet-overview
npm install
cp .env.example .env      # majd töltsd ki (lásd lent)
npm run dev               # http://localhost:4173
```

**Kulcs nélkül is működik a demó:** a „Demó" gomb egy beépített MOCK áttekintőt
tölt (a teljes UI + számítás látszik). Élő lánc-adathoz egy ingyenes kulcs kell:

- `VITE_ETHERSCAN_KEY` — **ez kell az élő módhoz.** Ingyenes: https://etherscan.io/apis
  (Etherscan V2, egy kulcs minden EVM-láncra). E nélkül a beírt cím lekérdezése
  „Missing/Invalid API Key" hibát ad, de a Demó gomb a mockot mutatja.
- `VITE_COINGECKO_KEY` — **opcionális.** A public demo endpoint kulcs nélkül is
  megy (csak lassabb rate); saját demo-kulccsal gyorsabb.

## Mit látsz
- Fejléc + cím-kereső + USD/HUF domináns-váltó (mindkét érték mindig látszik).
- Hero: **elégetett gas** animált számlálóval (USD nagy, HUF alatta — vagy fordítva).
- Be/ki ETH-cashflow (akkori árfolyamon), tx-szám, első/utolsó tx, legaktívabb hónap.
- Havi cashflow-oszlopdiagram (be/ki).
- Szűrhető tranzakció-tábla (mind/be/ki/ETH), gas oszloppal.
- Érintett tokenek (az USD/HUF token-árazás a 2. körben jön).

## Publikálás előtt (KÖTELEZŐ) — server-side proxy

Az MVP a `VITE_` prefix miatt a kulcsokat (Etherscan, Helius) a **kliens-bundle-be**
teszi — ez **csak helyi demóhoz** oké. Éles (nem-demo) mód előtt a kulcsos hívásokat
proxy mögé KELL tenni, hogy kulcs SOHA ne kerüljön a frontendbe. Ez deploy-modell
váltás — külön körben, jóváhagyással. A terv (Vercel edge functions):

1. `api/etherscan.ts` edge function: átveszi a query-paramokat, hozzáteszi az
   `ETHERSCAN_KEY`-t (sima env, NEM `VITE_`), továbbhívja az Etherscan V2-t,
   cache-eli (s-maxage) a választ. Rate-limit / origin-check a functionben.
2. `api/solana.ts` edge function: JSON-RPC passthrough a Helius endpointra
   (`HELIUS_KEY` szerver-oldalon); csak a whitelisted metódusok
   (`getBalance`, `getTokenAccountsByOwner`) engedettek.
3. Frontend: `src/lib/etherscan.ts` `BASE` és `src/lib/solana.ts` `RPC` env-ből
   kapcsolható a `/api/...` proxy-útvonalra (`VITE_API_PROXY=true`); a `VITE_*KEY`
   változók éles buildben ÜRESEN maradnak.
4. A keyless hívások (Blockscout, CoinGecko public, ensdata, mempool.space)
   maradhatnak kliens-oldalon — nincs bennük titok.
5. Bónusz: ugyanez a proxy oldja fel az **MNB-árfolyam** CORS-blokkját is (lásd lent).

## MNB hivatalos-árfolyam toggle — miért nincs még

2026-07-10-i vizsgálat: az MNB árfolyam-adata **böngészőből közvetlenül nem
lekérhető** — a `www.mnb.hu/arfolyamok.asmx` SOAP-szolgáltatás (a) nem küld
CORS-headert (`Access-Control-Allow-Origin` nincs), (b) a WAF a nem-böngészős
POST-okat is dobja, (c) publikus CORS-proxyn keresztül Cloudflare-challenge jön.
Kliens-only appból tehát az „MNB szerinti HUF" **nem építhető meg becsületesen**
(fake/harmadik-fél tükör adatot nem mutatunk). A fenti edge-proxy 5. pontja után
triviális: egy `api/mnb.ts` function napi cache-sel adja a hivatalos USD/EUR→HUF
fixinget, a UI-ban a CoinGecko-HUF mellett togglelhetően.

## Állapot (2026-07-10)
KÉSZ a 2. körből: SOL (keyless native + kulccsal SPL) + BTC (mempool.space),
token USD/HUF-árazás, **in-app approvals-lista** (Blockscout Approval-logok, 6 lánc,
kulcs nélkül) + revoke.cash deep-link, NFT-galéria, „tárcád története", CSV/PDF
export, ENS reverse-név + avatar, aktivitás/gas/cashflow **minden EVM címre
aggregálva**. Hátra: DeFi-pozíciók (keyless nem tiszta — lásd FEATURE_MATRIX),
MNB-toggle (proxy kell, fent), server-side proxy (publikálás-blokkoló).
