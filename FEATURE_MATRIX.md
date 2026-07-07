# Tárca-áttekintő — funkció-mátrix (best-free pozicionálás)

*Forge, 2026-07-07. „Mindent tudunk amit a fizetős appok, csak INGYEN."*
Vezető appok: Zerion, DeBank, Zapper, Rotki, Koinly, Rabby, Arkham, Nansen.

| Funkció | Ki adja | Náluk ingyen/fizetős | Nálunk | Státusz |
|---|---|---|---|---|
| Token-holdings (összes ERC-20) | mind | ingyen | ✅ keyless (Blockscout) | KÉSZ |
| USD + **HUF** érték minden tételen | senki HUF-natívan | — | ✅ HUF-natív + MNB-terv | KÉSZ (diff) |
| **Multichain** (eth/base/arb/op/polygon/gnosis) | Zerion/DeBank | ingyen | ✅ 5 lánc keyless, összevonva | KÉSZ |
| **Több-cím összevonás** | DeBank/Zerion Premium | részben fizetős | ✅ korlátlan cím + ENS | KÉSZ |
| ENS-feloldás (név↔cím) | mind | ingyen | ✅ keyless (ensdata) | KÉSZ |
| Portfólió-allokáció (pie + per-lánc) | mind | ingyen | ✅ donut + per-lánc sáv | KÉSZ |
| **Spam/hamis-ár szűrés** | DeBank/Zerion (curated) | ingyen | ✅ majors-whitelist + $1M cap guard | KÉSZ |
| NFT-galéria | mind | ingyen | ✅ keyless, valós képek | KÉSZ |
| **Approvals + revoke** (biztonság) | revoke.cash / DeBank | ingyen (revoke.cash) | ✅ 1-kattintásos revoke.cash deep-link | KÉSZ (in-app lista → 4. kör) |
| Elégetett gas (HUF hero) | senki nem hero-metrikaként | — | ✅ animált, akkori árfolyamon | KÉSZ (diff) |
| Cashflow-idővonal (havi be/ki) | Zerion/DeBank | ingyen | ✅ oszlopdiagram | KÉSZ |
| „Tárca története" narratíva | senki | — | ✅ megosztható kártya | KÉSZ (diff) |
| Counterparty-k (top partnerek) | Arkham | ingyen | ✅ tx-ekből | KÉSZ |
| Whale/nagy-mozgás jelző | Arkham/Nansen | Nansen fizetős | ⚠️ tx-flag alap kész, dúsítás 4. kör | RÉSZBEN |
| CSV export | Koinly/CoinTracking | fizetős (tax) | ✅ holdings + tx CSV | KÉSZ |
| PDF / nyomtatás | Koinly (tax-report fizetős) | fizetős | ✅ kliens-oldali print-to-PDF | KÉSZ |
| **DeFi-pozíciók** (lending/LP/staking) | Zapper/DeBank/Zerion | ingyen (de saját indexer) | ⛔ keyless NEM megoldható tisztán | 4. kör — lásd lent |
| **Per-token P&L** (cost-basis) | Zerion **Premium**, Koinly | fizetős | ⛔ cost-basis kell (history+hist. ár) | 4. kör |
| Történelmi portfólió-érték idővonal | DeBank/Zerion | részben fizetős | ⛔ historikus egyenleg = fizetős API | 4. kör |
| Valós ár/portfólió-riasztás (push) | Zerion/CoinStats | fizetős | ⛔ backend/push kell (kliens-only nem valódi) | 4. kör |
| Adó-riport (ország-specifikus) | Koinly/CoinTracking | **fizetős** | ⛔ nem cél (pozicionálás: nem adó) | KIZÁRVA |
| Fejlesztői API | DeBank Cloud/Zapper/Zerion | **fizetős** | — nem termékcél (mi app vagyunk) | N/A |

## Miért NEM megoldható keyless (őszinte indoklás — nincs fake)

- **DeFi-pozíciók**: az Aave-lending / Uniswap-LP / staking pozíciók protokoll-
  specifikus dekódolást igényelnek (nem sima token-egyenleg). A Zapper/DeBank/
  Zerion ezt SAJÁT indexerrel oldja meg; keyless-en csak fizetős API-jukkal (vagy
  protokollonkénti RPC-melóval) érhető el. **Nem fake-eltük** — a 4. körben egy
  fizetős API (Zapper/DeBank) VAGY egy szűk, top-protokollos RPC-dekóder a reális.
  Light heurisztika (aToken/LP-token szimbólum-felismerés) félrevezető lehet,
  ezért kihagytuk.
- **Per-token P&L**: entry-ár (cost-basis) kell → teljes tx-history + per-token
  historikus árfolyam (CoinGecko-id mapping tokenenként). A native ETH-flow már
  értékelt; a teljes token-P&L a 4. kör.
- **Valós riasztások**: kliens-oldalon csak nyitott tabbal „működne" — az nem
  valódi alert. Backend + push (vagy Telegram-bot) kell → 4. kör.
- **Történelmi portfólió-érték**: napi historikus egyenleg-snapshotok = fizetős
  adatforrás (DeBank/Zerion). A cashflow-idővonalunk a keyless közelítés.

## Ami MINKET megkülönböztet (a „miért minket" story)
1. HUF-natív (a Zerion/DeBank dollárban gondolkodik).
2. Az „elégetett forint" mint hero-metrika.
3. Teljesen ingyenes + kulcs nélkül működik (a demó is valós adatot mutat).
4. Multichain + több-cím összevonás fizetős előfizetés nélkül.
5. Megosztható „tárca-történet".
