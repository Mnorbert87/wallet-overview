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

## Publikálás előtt (KÖTELEZŐ)
Az MVP a `VITE_` prefix miatt a kulcsot a kliens-bundle-be teszi — ez **csak
helyi demóhoz** oké. Éles előtt egy vékony proxy (Vercel edge-function / kis
FastAPI) mögé kell tenni a lánc-API hívást, hogy a kulcs SOHA ne kerüljön a
frontendbe. A CoinGecko public hívás maradhat kliens-oldalon.

## 2. kör (a spec szerint)
SOL (Helius) + BTC (mempool.space), token USD/HUF-árazás, approvals-biztonsági
panel, NFT, DeFi-pozíciók, „tárcád története" story-scroll, MNB-hivatalos-árfolyam
toggle, CSV/PDF export.
