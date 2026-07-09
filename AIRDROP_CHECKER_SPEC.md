# Airdrop claim/miss checker — BUILD SPEC

*Forge (Fable 5), 2026-07-08. Cél: a tárca-áttekintő appba egy "elmulasztottál-e airdropot?" panel — keyless, HUF-natív, magyar UI, a meglévő glassmorphism/verified-flag mintában.*

Ez a doksi buildre megy. A megállapítások mögött verifikált forráskutatás + adversarial feasibility-verdict áll. Ahol keyless-en NEM megy valami, azt itt kimondjuk — nincs fake, nincs over-claim (a FEATURE_MATRIX „nincs fake" elve).

---

## 1. Mit ad a user kezébe

Egy publikus cím (vagy ENS) beírása után a panel négy státuszba sorolja az airdropokat:

| Státusz | Jelentés | Keyless detektálható? |
|---|---|---|
| **CLAIMABLE MOST** | Jogosult vagy ÉS még nem claimelted ÉS nyitva a claim | ✅ IGEN (Merkl API + on-chain read) |
| **MÁR CLAIMELT** | Jogosult voltál, be is gyűjtötted | ✅ IGEN (`isClaimed`/Claimed event/Transfer) |
| **ELIGIBLE (upcoming)** | Allokáció-listán vagy, claim még nem indult/pending | ⚠️ RÉSZBEN (allocation-DB kell) |
| **ELMULASZTOTT / LEJÁRT** | Jogosult voltál, NEM claimelted, a claim-ablak/sweep lezárult | ⚠️ RÉSZBEN (deadline/sweep-adat kell, off-chain következtetés) |

**Őszinte scope — mit lehet keyless-en, mit nem:**

- **Teljesen keyless, backend nélkül, most azonnal:** minden Merkl-en keresztül osztott kampány (userRewards API → accumulated vs claimed vs pending, sok láncon). Ez a legszélesebb egy-hívásos lefedettség.
- **Keyless, de curated lista kell hozzá:** a nagy nem-Merkl merkle-drop-ok (Uniswap/ENS/1inch-stílus). Ehhez kell (a) a cím allokáció-bejegyzése egy publikált listából, (b) egy on-chain read (`isClaimed(index)` vagy Claimed-event/Transfer). A distributor-címeket NEKÜNK kell karbantartani — nincs kanonikus „minden airdrop + claim-contract" regiszter.
- **NEM megoldható tisztán keyless-en:** teljes airdrop-univerzum automatikus felfedezése (melyik ismeretlen dropra voltál jogosult). Ehhez aggregátor kell (Earnifi/Bankless), ami vagy paywall, vagy kulcs+backend. A „MISSED/lejárt" pontos jelzés is off-chain következtetés: az on-chain `isClaimed` `false`-t ad akkor is, ha a tokent már visszaseperték — a lejárat/sweep tényét a kampány deadline-jából / on-chain end-time változóból / distributor-egyenlegből kell levezetni.

**Diff a piacon:** senki nem adja **HUF-értékkel** és magyar UI-val, keyless-first, connect-wallet nélkül. Az érték minden tételen USD + HUF (`sharedUsdHuf` faktor), verified-flag honesty — ismeretlen árú claimable amber „≈ ár?" badge-et kap és kimarad a headline-összegből (pontosan mint a PortfolioPanel).

---

## 2. Hogyan csinálják mások

| Eszköz | Mit ad | Hogyan | Keyless? | Tanulság nekünk |
|---|---|---|---|---|
| **Earnifi** (earni.fi → Bankless) | Unclaimed airdrop/token/NFT/POAP; expiry-alert | Saját curated „Research Platform" (1600+ asset / 88+ protokoll) + multichain on-chain engine; read-only cím | Discovery keyless, de **paywall** (~$21/hó Premium, most Bankless Claimables) | Ez a **versenytárs, nem build-alap** — nincs publikus API. A modell működik, de curated DB kell hozzá. |
| **Bankless Claimables** | Airdrop+reward+POAP+mint+vote+ENS-expiry, 32 lánc | Cím-alapú monitoring, curated claimables DB on-chain state ellen; claimed/unclaimed flag + manual override | Ingyen, de nincs publikus API | Manual „claimed" override jó UX-ötlet. ENS-expiry az egyetlen explicit deadline-jelzés. |
| **DeBank** | Portfólió-inline unclaimed DeFi reward + SAJÁT XP/token program | On-chain pozíció-olvasás | Nincs ingyen tier (Cloud API fizetős) | **Nem** dedikált 3rd-party airdrop-finder. Reward-in-portfolio, nem cross-protokoll eligibility DB. Kulcs+backend kell → keyless MVP-hez kizárva. |
| **de.fi** | „Claimable" portfólió-kategória (awaiting reward/airdrop) | On-chain pozíció-scan, direkt claim a dashboardról | Ingyen (basic) | Position-scan → csak on-chain pozícióhoz kötött dropot lát; tiszta allocation-lista drop nem jelenik meg. Ugyanaz a korlát mint nálunk. |
| **Zerion / Zapper** | Inline claimable reward; Zapper `CLAIMABLE` metaType (reward+airdrop) | Zapper portfolioV2 GraphQL, merkle-claim recipe | **Fizetős**, kredit-metered, kulcs → backend-proxy | Kulcsot nem lehet Vite-bundle-be tenni. Későbbi upgrade, nem MVP. |
| **Merkl** (Angle) | Unclaimed Merkl-reward bármely címre, sok láncon | Egyetlen merkle-root a Distributorra; proof+amount a **publikus v4 API-ból** | ✅ **KEYLESS, CORS-friendly, ingyen** | **Ez az MVP-gerinc.** Böngészőből közvetlenül hívható. Csak Merkl-kampányokat fed. |
| **revoke.cash** | — (NEM airdrop-eszköz) | Approval-inspekció/revoke | — | Nem adatforrás. Post-claim higiénia (a claim-contract kért approval visszavonása). Már benne van az appban (ApprovalsPanel). |
| **DefiLlama /airdrops** | Cím-alapú allokáció-lista | Curated CSV/JSON allocation-DB (NEM on-chain scan, NEM merkle-index) | Keyless a weboldal, de **nincs ingyen API** (emissions Pro-only) | Nem hívható adatforrás. A CSV-DB minta viszont pont a mi 2. körös registry-modellünk. |

---

## 3. Technikai megoldás — a detektálás módszertana

### 3a. Merkl v4 API (a KEYLESS gerinc)

Egy hívás, minden Merkl-lánc, kulcs nélkül, böngészőből:

```
GET https://api.merkl.xyz/v4/userRewards?user={address}
```

Válasz per-chain: `{ token: {address, symbol, decimals, price}, amount (accumulated), claimed, pending, proofs[] }`.
Claimable számítás (cumulative modell, NEM bitmap): `claimable = amount − claimed`. Merkl-nél **nincs "missed window"** — a nem-claimelt reward marad és halmozódik.

Claim-tx építéséhez (opcionális gomb, később): `GET https://api.merkl.xyz/v4/claim?user={address}&chainId={id}` → user, tokens, amounts, proofs. **Proof ~4h-t él, claim-időben újra kell kérni** (ne cache-eld).

Ez a lépés önmagában szállít egy multichain claimable-listát nulla kulccsal, nulla backenddel.

### 3b. Nem-Merkl merkle-drop-ok (Uniswap/ENS-stílus, curated)

Kanonikus `MerkleDistributor` primitívek (Uniswap-fork család, forrásból verifikálva):

- **CLAIMED vs UNCLAIMED read:** `isClaimed(uint256 index) view returns (bool)` — packed bitmap (`claimedBitMap`), `eth_call`-lal kulcs nélkül olvasható. Ehhez a cím **allokáció-bejegyzése** (index+amount+proof) kell egy publikált listából.
- **Claim event-ből (index nélkül):** `eth_getLogs` szűrve `topic0 = keccak256("Claimed(uint256,address,uint256)")` + `topic2 = a bal-padded cím`. VAGY a token `Transfer(from=distributor, to=cím)` logja. Mindkettő keyless read publikus RPC-n / Blockscout-on.
- **Eligibility forrás:** projektenként self-hosted (GitHub/IPFS JSON vagy `/api/eligibility?address=` endpoint). **Nincs** kanonikus regiszter → curated `registry.json`-t magunk tartunk.

**Következtetési logika (fix-allokációs drop):**
```
ELIGIBLE            = cím szerepel az allokáció-listán
MÁR CLAIMELT        = isClaimed(index) == true   (vagy van Claimed/Transfer log)
CLAIMABLE MOST      = listán van ÉS isClaimed==false ÉS (nincs deadline VAGY now<deadline) ÉS distributor tart tokent
ELMULASZTOTT/LEJÁRT = listán van ÉS isClaimed==false ÉS (deadline lejárt VAGY egyenleg leseperve)
```
A CLAIMABLE↔MISSED különbség **nem** az `isClaimed`-ből jön, hanem a kampány deadline-jából / on-chain end-time-ból / distributor-egyenlegből.

### 3c. MVP-path (keyless React+Vite, backend nélkül)

1. **Elsődleges forrás — Merkl v4** kliens-oldalról: azonnali multichain claimable-lista, 0 kulcs, 0 backend.
2. **Curated `registry.json`** (mi tartjuk): a legnagyobb nem-Merkl dropok (token, chainId, distributor-cím, `isClaimed` selector / proof-URL, deadline). Eligibility+claimed státusz keyless RPC/Blockscout read-tel, `multicall`-lal batch-elve.
3. **Solana** (opcionális): nincs keyless Merkl-ekvivalens → kulcsos (Helius/QuickNode) vagy hardcode program-check. **Halasztjuk.**

Kizárva MVP-ből: DefiLlama (nincs adat-API), DeBank/Zerion/Zapper/Earnifi (kulcs/backend/paywall).

---

## 4. Codebase-illesztés

### Új fájlok

- **`src/lib/airdrops.ts`** — adat-réteg, a `multichain.ts` kontraktusát tükrözve:
  - Export `fetchAirdrops(addresses, chainIds)` → tipizált eredmény (mint az `Asset`/`Portfolio` interface).
  - Merkl-ág: `jget`/`jgetRetry` mintában hívja a `v4/userRewards`-ot (CORS-OK böngészőből).
  - Registry-ág: `registry.json` beolvasás + `isClaimed` read.
  - Minden tétel `valueUsd` + `valueHuf` a shared `usdHufFactor`-ral (fallback 372); ár-hitelesség = `verified` flag.
- **`src/lib/airdropRegistry.json`** — curated nem-Merkl drop-lista (analóg a `multichain.ts` `CANONICAL` mapjével és a `solana.ts` `SPL_ALLOW`-jával).
- **`src/components/AirdropPanel.tsx`** — a `HoldingsPanel`/`PortfolioPanel` skeleton másolata:
  - `motion.div className="glass rounded-2xl p-5 mb-6"`, header-sor (`text-sm font-semibold text-slate-200` cím + `text-xs text-slate-500` subtitle).
  - Négy státusz-szekció; scrollos lista `space-y-1.5 max-h-72 overflow-y-auto pr-1`.
  - Amber verified-badge treatment (`bg-amber-400/10 text-amber-400/80`) az ismeretlen árú/pending tételre, pontosan a PortfolioPanel `!a.verified` mintája szerint.
  - `currency: 'usd'|'huf'` prop → `const fmt = currency==='usd' ? fmtUsd : fmtHuf`. **Soha ne formázz pénzt inline.**
  - Minden user-string a `DICT`-en át (`"airdrop.xxx": ["HU","EN"]`) + `const t = useT()`. Count-interpoláció `{n}`.
  - Külső linkek (claim/explorer): `target="_blank" rel="noopener noreferrer"` + `no-print`.

### Reuse a meglévő rétegből

| Kell | Honnan | Megjegyzés |
|---|---|---|
| Láncok, meta, színek | `multichain.ts` `CHAINS`/`CHAIN_META`, `COLORS` | direkt reuse |
| USD→HUF faktor | `multichain.ts` `sharedUsdHuf`/`usdHuf` | export van |
| CG-kulcs headerben | `multichain.ts` `cgHeaders()` | kulcs SOHA URL-be |
| ENS↔cím | `multichain.ts` `resolveInput()` | input-normalizálás |
| `jget`/`jgetRetry`/`fetchAllPages` | `multichain.ts` (private!) | **exportálni kell VAGY duplikálni** (mint `solana.ts`/`holdings.ts` teszi) |
| Formázók | `format.ts` `fmtUsd`/`fmtHuf` | dual-currency |
| i18n | `i18n.ts` `DICT`/`useT` | minden string ide |
| Beszúrás | `App.tsx` `Result()` | `{headAddr && <div className="mt-6"><AirdropPanel address={headAddr} currency={primary}/></div>}` az `ApprovalsPanel` sor után + import az `Extras` mellé |

Ha watchlist-szintű (összes tárca, multichain) kell single-cím helyett: adj át `pf`/`wallets`-et, tedd a `PortfolioPanel` után, saját `useEffect`-tel (a `fetchWatchlist` mintájára).

### A GAP (fő hiányzó primitív)

`grep` megerősítette: az `etherscan.ts` csak `action=txlist` és `action=tokentx`-et használ — **nincs `getLogs`, nincs `eth_call`/`read-contract` helper, nincs airdrop-registry.** A claim/miss detektáláshoz legalább egy ezekből kell, reuse-sorrendben:

1. **`getLogs(contract, topics, fromBlock)`** az `etherscan.ts`-be (Etherscan V2 `module=logs&action=getLogs`), a meglévő `call()`/`callAll()` paginációt újrahasználva — **legolcsóbb, egy függvény.**
2. **`ethCall(contract, data)`** helper (`module=proxy&action=eth_call`) az `isClaimed`/`claimable(address)` view olvasásához.
3. Blockscout `/api/v2/addresses/{contract}/logs` `fetchAllPages`-szel (keyless, multichain, nehezebb).

Másodlagos gap: a private `jget`/`jgetRetry`/`fetchAllPages` nem exportált → exportálni vagy duplikálni.

**Minimál első verzió opció:** az `ApprovalsPanel` precedensét követve (deep-link egy megbízható külső eszközre) az AirdropPanel v0 **deep-linkelhet** Merkl/Bankless-re, amíg a `getLogs`-backed valós detekció beépül. De a Merkl-ág olyan olcsó (1 fetch, 0 gap), hogy a valódi claimable-lista már v1-ben reális.

---

## 5. MVP-scope vs. 2.–3. kör

### MVP (reálisan fél–egy nap, keyless, 0 backend)
- `airdrops.ts` Merkl-ág: `v4/userRewards` per cím, per lánc → claimable/claimed/pending.
- `AirdropPanel.tsx`: két szekció (**CLAIMABLE MOST**, **MÁR CLAIMELT**), HUF+USD, verified-flag, amber ismeretlen-ár.
- i18n stringek, beszúrás `App.tsx`-be, print/CSV-kompatibilis.
- „Claim" gomb = külső deep-link (Merkl app), NEM in-app tx (nincs kulcs/aláírás az appban).

### 2. kör
- `getLogs`/`ethCall` helper az `etherscan.ts`-be.
- `airdropRegistry.json` + 5–10 marquee nem-Merkl drop (Uniswap/ENS/…): `isClaimed` read `multicall`-lal.
- **ELMULASZTOTT/LEJÁRT** szekció: deadline/sweep-mező a registry-ben → MISSED-következtetés.
- Manual „claimed" override (Bankless-minta), localStorage-ban.

### 3. kör
- Solana-ág (kulcsos, ha Főnök vállalja a kulcs+proxy-t).
- Bővebb DeFi-reward lefedettség fizetős API-val (Zapper `CLAIMABLE` metaType), backend-proxy mögött.
- Expiry-alert (push) — backend kell, kliens-only nem valódi (lásd FEATURE_MATRIX 4. kör érvelés).

---

## 6. Kockázatok / őszinte korlátok

- **Nincs teljes felfedezés keyless-en.** Csak Merkl-kampányt + a curated registry-t látjuk. Egy ismeretlen dropot, amire nincs Merkl és nincs registry-bejegyzés, NEM fogunk elkapni. Ezt a UI-ban ki kell mondani („Merkl + követett kampányok — nem teljes univerzum").
- **A "MISSED/lejárt" következtetés, nem tény.** `isClaimed==false` marad akkor is, ha a tokent már visszaseperték. Rossz deadline-adat → hamis „még claimable" (túl-ígéret) vagy hamis „lejárt". A registry deadline/end-time mezőit gondosan kell tölteni; bizonytalan esetben inkább „claimable? — ellenőrizd" mint magabiztos állítás.
- **Spam-airdrop szűrés kötelező (a Base „ETH" scam-token tanulság mintájára).** Ismeretlen distributor-ból érkező „claimable" token lehet scam (fake szimbólum, mérgezett claim-contract). Szabály: (a) csak Merkl-ből VAGY registry-ből jött tétel számít; (b) ismeretlen árú/ismeretlen szimbólum → amber, headline-összegből KI (mint a PortfolioPanel `suspiciousFiltered`); (c) claim-linket CSAK verifikált distributorra adunk — soha ne linkeljünk random contract claim-jére (approval-drain veszély).
- **Ár-hitelesség.** Claimable token ára gyakran nincs CG-n (frissen listázott/pre-market). `verified=false`, „≈ ár?" badge, kimarad a HUF-heróból. Nincs fabrikált érték.
- **Public RPC limitek.** `eth_getLogs` block-range cap (gyakran 10k blokk) + rate-limit → teljes-history scan lassú/megbízhatatlan. Blockscout keyless bőkezűbb, de nehezebb. A `getLogs`-ág 2. körben, óvatos block-range-kezeléssel.
- **Merkl proof-lejárat (~4h).** Ha claim-gombot építünk, proof-ot claim-időben kell újra-fetchelni, nem cache-elni.
- **DeBank/Zapper/Zerion nem opció keyless-en.** Kulcs a Vite-bundle-ben szivárog. Csak backend-proxyval, 3. körben.

---

## 7. Nyitott döntések Főnöknek

1. **Single-cím vagy watchlist-szintű?** Az `ApprovalsPanel` single-`headAddr`-es; az airdrop-check hasznosabb az összes követett tárcára. Watchlist-szintű = kicsit több munka (saját `useEffect`), de jobb termék. Melyik?
2. **v0 deep-link vs v1 valós Merkl-lista?** A Merkl-ág olyan olcsó, hogy javaslom egyből a valós listát (v1), a deep-link-only v0-t átugorni. Jóváhagyod?
3. **Claim-gomb az appban?** Az app keyless/watch-only. Javaslat: SOHA in-app claim-tx (nincs kulcs/aláírás), csak deep-link a hivatalos claim-felületre. Egyetértesz?
4. **Registry karbantartás.** A nem-Merkl dropokat (2. kör) kézzel kell tartani. Vállaljuk-e ezt a folyamatos „top-10 drop" karbantartást, vagy MVP marad Merkl-only?
5. **`multichain.ts` refaktor.** A `jget`/`jgetRetry`/`fetchAllPages`-t exportáljuk (tisztább, de érinti a meglévő fájlt) vagy duplikáljuk `airdrops.ts`-be (izoláltabb)? Javaslat: export — kevesebb drift.
6. **MISSED szekció megjelenjen-e MVP-ben?** Registry+deadline nélkül nem tudjuk megbízhatóan → javaslom 2. körre halasztani, MVP-ben csak claimable+claimed. Rendben?
