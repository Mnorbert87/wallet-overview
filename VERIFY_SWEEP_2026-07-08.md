# Wallet-Overview — Verify-sweep + remaining-bug report (2026-07-08)

25-agent verify-sweep: re-verified every 2026-07-08 audit finding against current source (adversarial double-check), + fresh-eyes sweep of uncovered areas. file:line refs verified against source.

## VERDICT
NEM ship-ready. A SHIP-BLOCKER keyless scam-„ETH" VERIFIKÁCIÓS logika javítva (multichain.ts:241 `contractMatchesCanonical`, nincs bare-symbol ALLOWLIST) — a $34k fake-total nem nyílhat újra a totálban. DE a build nem adható ki, mert:
(a) a fix UNCOMMITTED — git HEAD (4bfbe35) még a bugos ALLOWLIST-verziót szállítja;
(b) a scam token még mindig valós dollár-értéket MUTAT a listában (PortfolioPanel:81);
(c) üres/hibás fetch fabrikált mock-totált csúsztat a headerbe (App.tsx:69-70).

## MI VAN JAVÍTVA (megerősítve, NE bántsd)
- SB / C1: bare-symbol verify megszűnt, verified = contractMatchesCanonical (multichain.ts:241) — fixed.
- C2: sanity-cap mindkét ágon fut, capOk (multichain.ts:295-301) — fixed.
- C3: CG cross-check catch fail-CLOSED + jgetRetry backoff (multichain.ts:337,347) — fixed.
- C4: `interval` param eldobva, keyless days<=365, series() nem dob, graceful degrade (price.ts:33,57,37-50) — fixed.
- C5: acct/token/NFT fetch izolálva, token-429 nem ejti a láncot (multichain.ts:205-213,190) — fixed.
- C6: callAll lapozó, full history gas/cashflow (etherscan.ts:57-68) — fixed (200k tx plafon).
- C8: fetchAllPages next_page_params loop (multichain.ts:179-196) — fixed (8/6 lap cap).
- C9: CG kulcs csak x-cg-demo-api-key headerben, soha URL-ben (multichain.ts:162-164, price.ts:35,84) — fixed.

## MI VAN MÉG HÁTRA (prioritált)

### CRITICAL
- **App.tsx:69-70** — üres/hibás valós fetch → mockPortfolio() fabrikált totál, NINCS isMock flag, rossz gate (VITE_ETHERSCAN_KEY, amit a portfolio-út nem is használ). Fix: soha ne csúsztass mockot a trusted totálba; explicit demo-módhoz kösd, üres wallet=$0, látható „sample data" banner.
- **aggregate.ts:61-62** — headertotál csak `verified` assetet összegez; keyless módban ez csak a ~8 kanonikus + native, minden más valós token (LINK/UNI/AAVE/PEPE…) kimarad → a felhasználó töredék-értéket lát jelzés nélkül. Fix: bővebb token-lista (chain,contract) VAGY prominens „N/M asset fedve, add CG-kulcsot" figyelmeztetés a kihagyott USD-vel.

### HIGH
- **git working tree vs HEAD** — a teljes fix UNCOMMITTED (10 módosult fájl +420/-165, src/lib/i18n.ts untracked). `npm run build` klón után a SEBEZHETŐ buildet reprodukálja. Fix: commitold az egészet + git add i18n.ts.
- **PortfolioPanel.tsx:71-85 (81)** — unverified scam token (symbol „ETH"/„USDC") valós dollárértéket ír ki (fmt(val(a))), csak apró amber badge különbözteti → vizuálisan újrateremti a $34k sort. Fix: unverified assetnél NE renderelj dollárszámot, csak „≈ ? (price unverified)".
- **bitcoin.ts:18,31** — BTC verified:true akkor is ha btcUsd=0 (CG rate-limit) → whale BTC némán $0-ként számít a totálba. Fix: verified = btcUsd > 0 (Solana-minta).
- **multichain.ts:220-223,295 (C7 partial)** — EVM native mindig verified ÉS cap-mentes: rossz Blockscout exchange_rate korlátlanul felfújja a totált; nRate=0-nál viszont DUST alá esik és eltűnik a native (xDAI). Fix: native ár CG-vel cross-check + sanity-bound; L223: `if (nAmt>0) push(..., nRate>0)`.
- **multichain.ts:228-229,286-289,295** — keyless a Blockscout exchange_rate-et vakon hiszi el a kanonikus+native asseteknél, és kiveszi őket a cap alól. Fix: kanonikus/native árat keyless CG /simple/price-szal igazold, vagy deviation-guard (stablecoin != $1).
- **multichain.ts:341-347** — CG token-ár verbatim (verified + amount*px), likviditás/volumen-check nélkül → airdrop-olt, pumpolt thin-token ~$1M/token-t injektál a watched totálba. Fix: CG market-cap/volumen floor VAGY per-asset cap CG-verifikáltra is; incoming-only airdrop ignore.
- **multichain.ts:341-347,324** — CG 429/missing → canonical-only fail-close, tranziens rate-limit némán ejt valós tokeneket, nincs portfolio-szintű degraded flag. Fix: last-known-good ár cache 429-nél + „pricing degraded" jelző.
- **compute.ts:44-46** — `Math.min(...allSecs)` ~400k elemre RangeError (200k+200k tx). Fix: reduce/for-loop min/max.
- **price.ts:82-88** — ethSpot() nincs r.ok/try-catch: 429 nem-JSON body → buildOverview reject VAGY spot=0 némán $0-zza az ETH-holdingot. Fix: try/catch + r.ok, degraded jel.

### MEDIUM
- **holdings.ts:78-93** — dead-but-shipped fetchHoldings = az eredeti symbol-trust bug szó szerint (NaN is mérgezi a totalUsd-t), egy import a reaktiválástól. Fix: töröld a modult + HoldingsPanel.tsx (csv.ts-t Asset típusra), vagy tedd rá a contractMatchesCanonical gate-et.
- **etherscan.ts:43-53,76-78** — call() nincs r.ok; rate-limit JSON nem matchel a regexre → dob a callAll közben, minden addigi lap elvész; BigInt() egy rossz soron az egész .map-et dobja. Fix: r.ok check, per-lap catch + partial return, safe BigInt-parse (0n default).
- **compute.ts:65,93** — new Date(NaN).toISOString() dob az aggregációs loopban. Fix: Number.isFinite(timeStamp) guard.
- **i18n.ts:8 + dist** — publikus build VITE_EN_ONLY nélkül készült → HU default + HU/EN toggle. Fix: `VITE_EN_ONLY=true vite build`, rebuild dist.
- **multichain.ts:198-203,252** — USD→HUF fallback hardcoded 372, némán driftel; redundáns 2. usdHuf() fetch. Fix: „FX stale" flag, last-good cache, egy faktor átfűzve.
- **multichain.ts:233,40-41** — 0/hiányzó árú valós token spam/dust-ként HARD-dropolva (lista+totál). Fix: „no price" != spam, tartsd meg verified:false best-effortként; SPAM_RE szűkítés.
- **multichain.ts:179-196** — holdings-lapozás 8 lap cap + néma break page-hibán → sok-tokenes wallet alulszámol jelzés nélkül. Fix: cap emelés/retry + „partial data" flag.
- **aggregate.ts:47-62** — SOL/BTC verified asset megkerüli a $1M cap-et (a cap csak fetchPortfolio-ban él). Fix: egységes capOk minden asseten (EVM+SOL+BTC) a summázás előtt.

### LOW
- **solana.ts:64** — uiAmount null nagy SPL-egyenlegnél 0-ra esik. Fix: uiAmountString preferálás + Number.isFinite.
- **price.ts:43-46** — series() nem guardolt j.prices shape + any-cast. Fix: Array.isArray guard, finite-price skip.
- **price.ts:64-66** — HUF-only filler nap usd:0-t ad priceAt-nek → txt $0-ra snappel. Fix: last-known érték átvitele.
- **multichain.ts:226** — hiányzó decimals→18 default nagyságrendi hiba. Fix: on-chain/token-list decimals, addig unverified.
- **AUDIT_FINDINGS_2026-07-08.md** — stale (ALLOWLIST.has(sym):152, régi sorszámok). Fix: contract-based verifierre frissíteni.
- **compute.ts:110,119** — holdingValue net-flow becslés (!= valós egyenleg, != header totál). Fix: „net-flow estimate" címke.

## ÚJ TALÁLATOK (eredeti audit nem fogta)
- App.tsx:69-70 — mockPortfolio() fabrikált totál rossz gate-tel, isMock flag nélkül (CRITICAL, veszélyesebb mint a scam-ETH: teljesen kitalált szám).
- aggregate.ts:61-62 — verified-only totál keyless módban a valós vagyon töredékét mutatja (CRITICAL alulbecslés).
- Uncommitted fix: git HEAD még a bugos ALLOWLIST buildet szállítja (HIGH ship-gate).
- PortfolioPanel.tsx:81 — a scam token még mindig valós dollárértéket MUTAT (a bug „display fele").
- bitcoin.ts:18,31 — BTC verified:true 0 árnál; aggregate.ts SOL/BTC cap-megkerülés.
- multichain.ts:341-347 — CG-listed thin-token airdrop-inflation (~$1M/token) watch-only támadási vektor.
- Robusztusság: compute.ts Math.min spread RangeError, ethSpot() catch-hiány, etherscan.ts BigInt/r.ok, Date(NaN) throw — mind keyed-user néma törést okoz.
- Build/config: VITE_EN_ONLY hiánya, VITE_ kulcs-leak footgun, holdings.ts dead-code bug.

## AJÁNLOTT SORREND (ship előtt)
1. **COMMIT** a teljes working tree + `git add src/lib/i18n.ts` — különben minden más fix illuzórikus (git HEAD sebezhető).
2. **PortfolioPanel.tsx:81** — unverified assetnél tiltsd le a dollárszámot (a scam-ETH vizuális fele).
3. **App.tsx:69-70** — mock kivezetése a trusted totálból + isMock flag/banner + üres=$0 + portfolio-gate leválasztása VITE_ETHERSCAN_KEY-ről.
4. **bitcoin.ts:31** verified=btcUsd>0 + **multichain.ts:223** native amount>0-always-show (C7 zárása) + **aggregate.ts** egységes capOk (SOL/BTC/EVM).
5. **aggregate.ts:61-62** — keyless total-lefedettség: „N/M asset fedve" figyelmeztetés + bővebb token-lista.
6. **multichain.ts:341-347** — CG-ár korlátozás (volumen floor/per-asset cap) + 429 last-good cache + degraded flag; native/kanonikus ár keyless CG cross-check.
7. **Robusztusság-kör**: compute.ts min/max reduce + Date(NaN) guard, price.ts ethSpot try/catch + series() shape-guard, etherscan.ts r.ok/BigInt/partial-return.
8. **Takarítás**: holdings.ts + HoldingsPanel.tsx törlése (vagy gate), VITE_EN_ONLY=true rebuild, FX-stale flag, AUDIT_FINDINGS frissítés.
