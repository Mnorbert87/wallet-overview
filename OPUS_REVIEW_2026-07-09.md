A findingok stimmelnek a jelenlegi kóddal (App.tsx:69-70, bitcoin.ts:31, multichain.ts:26/38). Itt a rendezett riport.

---

# Wallet-Overview — Lead Review (working-tree, post-fix, 2026-07-09)

31 verifikált, nyitott finding. Súlyosság szerint. Formátum: `file:line — probléma → fix`.

## 🔴 SHIP-BLOCKER (1)

1. **`src/App.tsx:69-70` (+ headline `:258`, copy `src/lib/i18n.ts:69-70`)** — Keyless módban ha `fetchWatchlist` üres portfóliót ad (assetCount===0 & 0 unverified) VAGY hibázik, `mockPortfolio()` kerül `pf`-be, DE `setIsMock(true)` SOHA nem hívódik a portfólió-ágon (csak a gas/Overview ágon, `:82-83`). A headline `pf.totalUsd` így egy fabrikált ~$96k-t mutat NULLA figyelmeztetéssel; ráadásul a `mock.notice` copy explicit azt állítja "a multichain token-portfólió VALÓS". Egy tényleg üres tárca is fabrikált hatszámjegyű totált kap. → `isMock: true` flag a `mockPortfolio.ts`-ben; a fallback NE triggerelődjön assetCount===0-ra (üres tárca = valid $0, nem ok a fabrikálásra); külön "DEMO adat" banner; a `mock.notice` copy javítása hogy ne állítsa valósnak.

## 🟠 CRITICAL (2)

2. **`src/App.tsx:69-70` (headline `:254-260`, `src/lib/mockPortfolio.ts:6-33`)** — Ugyanaz a mock-fallback a user SAJÁT címéhez rendel ~$700k fabrikált holdingot (mind `verified:true`), demo-indikátor nélkül; tranziens Blockscout-kimaradás is ezt triggeri. → Ne rendelj mock holdingot valódi címhez: vagy dobd a fallbacket és mutass "adatforrás nem elérhető" empty-state-et, vagy dedikált `pf.isMock` flag + félreérthetetlen "DEMO — nem ez a tárca" banner + total kinullázása; a fallbacket kösd explicit demo-akcióhoz, ne üres eredményhez.

3. **`src/components/Extras.tsx:27-29`** — StoryCard footer: "a számok a valós on-chain aktivitásból származnak", miközben keyless/demo módban `ov=mockOverview()` (fabrikált gas/inflow/tx/dátum). Screenshotolható kártya hamis számokat állít valósnak. → `isMock` flag átadása StoryCard-nak; mock esetén rejtsd a kártyát vagy cseréld a copy-t "minta/demo adat"-ra, soha ne render "valós on-chain" wording mockra.

## 🟡 HIGH (13)

4. **`src/lib/bitcoin.ts:31` (ár `:18`)** — BTC asset feltétel nélkül `verified:true`, de `btcUsd` CoinGecko rate-limitnél 0-ra esik → valueUsd=0, mégis verified → a total `$0`-ként számolja, a valódi BTC-egyenleg csendben eltűnik a headline-ból. → `verified: btcUsd > 0` (mint solana.ts:80); a sor látszik "price unavailable"-lel, de nem húzza le a totált.

5. **`src/lib/price.ts:57 (+76-78, 27)`** — Keyless módban a price-map 365 napra van vágva; `priceAt()` a `best=keys[0]`-t inicializálja és csak `k<=key`-ig lép, így MINDEN 365 napnál régebbi tx az ~1 éve árán értékelődik. Több éves tárcánál a burned-gas USD és az egész cashflow-chart szisztematikusan félreárazott. → Hosszú history-nál market_chart/range demo-kulccsal, VAGY degradation-notice + érintett hónapok jelölése; minimum a már definiált `priceDataDegraded()` kivezetése.

6. **`src/lib/compute.ts:48` (fogyasztatlan `src/lib/price.ts:27`; render `src/App.tsx:280-286`)** — `priceDataDegraded()` exportált de sehol nem hívott. 429-nél a price-map üres, minden per-tx valuation 0-ra esik (gas/inflow/outflow USD+HUF=0), a 3 headline MetricCard $0-t mutat tényként. → `priceDataDegraded()` fogyasztása `buildOverview`-ban, `priceDegraded` bool az Overview-ba, warning + USD/HUF elrejtése (ETH amount marad) az App.tsx-ben.

7. **`src/lib/multichain.ts:25-26 (+:38)`** — `SPAM_RE` a NÉVRE is fut; a `[a-z0-9-]+\.(finance|io|...)` alternáció matcheli valódi blue-chip DeFi neveket (yearn.finance/YFI, Badger/Harvest/Cream/Origin.finance), a bare `access`/`earn ` is legit neveket. Ezek `dust++`-ba mennek és teljesen eltűnnek a portfólióból. → A domain/URL-heurisztikát NE futtasd a névre; külön `NAME_SPAM_RE` domain-TLD és bare `access`/`earn` alternáció nélkül; `SPAM_RE.test(s) || NAME_SPAM_RE.test(n)`. Vagy csak scheme/`www.` prefixnél alkalmazd a TLD-tesztet.

8. **`src/lib/etherscan.ts:43-53, 57-68, 102-118` (caller `compute.ts:42`)** — Nulla retry/backoff a paginációban; egyetlen 429 a 3. oldalon eldobja a már lekért oldalakat ÉS abortálja az egész overview-t (gas, cashflow, teljes tx-history). → `jgetRetry`-szerű wrapper `call()` köré (2-3 próba, 500ms*attempt backoff); `callAll()` adja vissza az eddig felgyűlt sorokat terminal failure-nél (mint `fetchAllPages`).

9. **`src/lib/etherscan.ts:45-52`** — `call()` nem néz `r.ok`-t; a 429 `"Max rate limit reached"` NEM matchel a `/no transactions|no records/i` guardra → hard throw. HTML-es 429/503 esetén `r.json()` maga dob. → `r.status` ellenőrzés: 429/5xx-en retry+backoff; a benign-branch bővítése `/rate limit|max .*limit/i`-vel (retryable).

10. **`src/lib/solana.ts:51-56 (+93-95)`** — `getBalance` és a legacy SPL-hívás egy `Promise.all`-ban, per-call catch nélkül (csak a Token-2022 hívásnak van). Ha a legacy SPL 429-el miközben getBalance sikerült, az egész SOL-lánc üresen tér vissza `error:true`-val — a valódi SOL-egyenleg eltűnik. → Per-call izoláció: `getBalance(...).catch(()=>null)`, `legacy(...).catch(()=>[])`; `error:true` csak ha getBalance maga bukik; retry/backoff az `rpc()`-be.

11. **`src/components/Extras.tsx:18-29, :38, :90-98`** — StoryCard importál `useT()`-t de sosem hívja; a teljes narratíva, a "Leggyakoribb partnerek" heading és az egész ApprovalsPanel hardcoded magyar. EN-only buildben ez a screenshotolható kártya 100% HU. → `story.*`/`cp.*`/`approvals.*` DICT-kulcsok i18n.ts-be, minden literál `t(...)`-re.

12. **`src/components/TxTable.tsx:29,31,38-43,52-54,72`** — TxTable egyáltalán nem használ `t()`-t; heading, szűrők, oszlopfejlécek, irány-cellák, pagináció mind hardcoded HU. → `tx.*` kulcsok + `useT()`/`t()` routing.

13. **`src/components/CashflowChart.tsx:16,28` (+`App.tsx:305,307-308`)** — Tooltip legend és empty-state literál HU, a körülvevő chart-card title/legend is. → `cf.received/cf.sent/cf.empty` i18n.ts-be, `t()` átadása.

14. **`src/App.tsx:281-298`** — Az összes activity MetricCard/InfoCard `label` prop hardcoded HU literál. → `metric.*` kulcsok; a fordítás a call-site-on (MetricCard maradjon label-agnosztikus).

15. **`src/components/Watchlist.tsx:38-39,43-48,54,71,81` (render `App.tsx:206`)** — Watchlist sosem használ `t()`-t; heading, sub, placeholderek, gomb, empty-state, tooltipek mind HU. Ez a panel mindig látszik → EN user HU-only core panelt lát first-loadon. → `wl.*` kulcsok + `useT()`.

## 🟢 MEDIUM (7)

16. **`src/lib/aggregate.ts:61-62`** — A sanity-cap csak a per-EVM fetchben fut (`multichain.ts:295-301`), a merged watchlist-totálon nincs újra-ellenőrizve; a SOL/BTC assetek teljesen megkerülik. Egy CG-crosschecked vagy mispriced curated SPL uncapped-ként számít a totálba. → Ugyanaz a `capOk()` (native || canonical || valueUsd<=SANITY_CAP_USD) a verified-set építésekor aggregate.ts-ben.

17. **`src/lib/aggregate.ts:9,:32` (+`multichain.ts:252,218,202`; `aggregate.ts:79`)** — `usdHuf` FX-faktor N+1-szer kérve (wallet-enként külön CoinGecko-hívás); rate-limitnél némán a hardcoded 372 fallbackra esik → egyes assetek valueHuf-je élő ráta, mások 372, a headline HUF total eltér a lista összegétől. → A már lekért `factor` átfűzése `fetchPortfolio`-ba paraméterként; FX-endpoint pontosan egyszer.

18. **`src/lib/aggregate.ts:61-62`** — (defense-in-depth) A cap csak az egyik producernél (EVM) érvényesül; SOL assetek `verified:true`-val, CG-származtatott értékkel, cap nélkül folynak a totálba — CG price-glitch/kompromittált allowlisted mint korlátlanul beszámít. → Végső cap-invariáns aggregate.ts-ben summázás előtt; `SANITY_CAP_USD`+`capOk` exportálása multichain.ts-ből (egy source of truth).

19. **`src/lib/bitcoin.ts:11-16, 34-36`** — Egyetlen mempool.space fetch retry nélkül; 1 db 429 → az egész BTC-lánc üres (`error:true`), native BTC elveszik. → Retry-loop (2 próba, ~500ms backoff) az account-fetchre.

20. **`src/lib/i18n.ts:42-43`** — `footer.disclaimer` csak "Etherscan + CoinGecko"-t nevez meg, kihagyja Blockscout/Helius-RPC/mempool.space-t → félrevezető provenance. → Mindkét HU/EN érték felsorolja a valós forrásokat.

21. **`src/components/PortfolioPanel.tsx:19`** — A pie "Egyéb" bucket-label hardcoded HU; EN buildben magyar szelet. → `pf.other = ["Egyéb","Other"]`, `t('pf.other')`.

22. **`src/App.tsx:141-151, 23-33, 186-196; TxTable.tsx:15-24; Watchlist.tsx:81,70-71`** — Toggle-gombok (USD/HUF, nyelv, chain-szűrő, tx-filter) nincs `aria-pressed`; icon-only ✕ gombnak nincs accessible name. → `aria-pressed={...}` minden toggle-re + `aria-label` az icon-gombokra.

## ⚪ LOW (8)

23. **`src/lib/multichain.ts:39`** — `/[^\x20-\x7E]/.test(s)` bármely nem-ASCII szimbólumú legit tokent dob (currency-glyph, nem-latin projekt-tokenek). → Szűkítsd a rejectet a tényleges homoglyph/zero-width/combining/Cyrillic-Greek tartományra; benign non-ASCII maradjon az unverified listán.

24. **`src/lib/etherscan.ts:44`** — Etherscan kulcs URL query-ben (history/Referer-leak) live módban; a CoinGecko kliens szándékosan headerbe került, ez nem. → Hardened deployhoz server-side proxy; keyless publikus buildet nem érint (nincs kötelező kód-változás).

25. **`src/lib/bitcoin.ts:31` (`:18`)** — (a #4 low-duplikátuma) BTC verified marad btcUsd=0-nál is, verified $0-ként számít. → `verified: btcUsd > 0`.

26. **`src/lib/solana.ts:41-47`** — `cgPrices()` egyszeri, retry nélküli fetch; CG 429-nél minden allowlisted SPL (USDC/USDT) 0-árra → unverified → kiesik a totálból. → 2-próbás retry/backoff; opcionálisan last-known ár cache.

27. **`src/lib/multichain.ts:179, :211, :212`** — `fetchAllPages` ERC-20 cap=8 / NFT cap=6; ~400 token / ~300 NFT felett csendes undercount, nincs jelzés cap-hit vs. kimerülés. → Cap-hit trackelése (`params!=null && page===cap`) + "holdings may be truncated" flag; ERC-20 cap emelése megfontolandó.

28. **`src/lib/multichain.ts:210, :220-223`** — Native balance-fetch `jget` (nem `jgetRetry`) `.catch(()=>({}))`-vel; 1 db 429 → coin_balance 0 → a lánc legértékesebb assete csendben dobódik. → `jgetRetry(..., 2)` a native fetchre (izoláció megmarad).

29. **`src/App.tsx:160-166; Watchlist.tsx:43-46,65`** — A fő cím-input csak placeholderre támaszkodik accessible name-ként. → `aria-label={t('search.placeholder')}` + a Watchlist inputokra.

30. **`src/components/TxTable.tsx:61`** — Valós ETH-transzfer usd:0-val "—"-ként renderel, megkülönböztethetetlen a tényleg érték nélküli sortól. → amount>0 && val===0 esetén neutrális "?"/"n/a" + title "price unavailable".

31. **`src/App.tsx:69` (`:216-217`; `PortfolioPanel.tsx:56-69`)** — Nincs top-level empty-state a "tárcák vannak, 0 holding" esetre (keyed build): $0 total + üres pie, nincs "no assets found". → `t('pf.noHoldings')` top-level empty-state Result/PortfolioPanel-ben.

---

## Ship-verdict

**NEM leadás-kész.** Az egyetlen legfontosabb, azonnal javítandó: a `src/App.tsx:69-70` mock-portfólió fallback, amely a user saját címéhez fabrikált ~$96k–$700k `verified:true` totált rendel `isMock` flag nélkül, sőt a banner explicit "VALÓS"-nak állítja — ez pontosan az a totals-integritási hiba (fabrikált mock + valósnak hazudott szám), ami korábban is kilőtte az auditot, és önmagában ship-blocker; amíg ez él, a demo build megbízhatatlan számot mutat, és a #4/#5/#6/#7/#10 (BTC/SOL/price-degrade csendes $0-drop + valódi token spam-drop) tovább rontja a totál-korrektséget.