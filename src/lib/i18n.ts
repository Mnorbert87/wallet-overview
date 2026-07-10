// Könnyű i18n: HU/EN, külső store-ral (setLang → minden komponens újrarendel).
// A PUBLIKUS build EN-only: VITE_EN_ONLY=true env → a toggle elrejtve, nyelv=EN.
import { useSyncExternalStore } from "react";

export type Lang = "hu" | "en";

// Publikus/hivatalos build: egyetlen flaggel EN-only.
export const EN_ONLY = (import.meta.env.VITE_EN_ONLY as string) === "true";

let lang: Lang = EN_ONLY
  ? "en"
  : (((typeof localStorage !== "undefined" && localStorage.getItem("wo-lang")) as Lang) || "hu");

const subs = new Set<() => void>();

export function getLang(): Lang { return lang; }
export function setLang(l: Lang): void {
  if (EN_ONLY || l === lang) return;
  lang = l;
  try { localStorage.setItem("wo-lang", l); } catch { /* ignore */ }
  subs.forEach((f) => f());
}
function subscribe(cb: () => void) { subs.add(cb); return () => subs.delete(cb); }
export function useLang(): Lang { return useSyncExternalStore(subscribe, getLang, () => lang); }

// [HU, EN]
const DICT: Record<string, [string, string]> = {
  "app.title": ["Tárca-áttekintő", "Wallet Overview"],
  "app.subtitle": ["Kripto portfólió-mozgás egy pillantásra — dollárban és forintban.",
                   "Crypto portfolio at a glance — in USD and HUF."],
  "cur.usdFirst": ["USD elöl", "USD first"],
  "cur.hufFirst": ["HUF elöl", "HUF first"],
  "search.placeholder": ["Tárca hozzáadása: ETH 0x… / SOL base58 / BTC bc1… / ENS (több is, vesszővel)",
                         "Add wallet: ETH 0x… / SOL base58 / BTC bc1… / ENS (multiple, comma-separated)"],
  "btn.add": ["Hozzáad", "Add"],
  "btn.demo": ["Demó", "Demo"],
  "label.chains": ["Láncok:", "Chains:"],
  "err.needAddress": ["Adj meg egy címet (ETH 0x… / SOL base58 / BTC bc1…) vagy ENS-nevet.",
                      "Enter an address (ETH 0x… / SOL base58 / BTC bc1…) or ENS name."],
  "empty.addWallets": ["Adj hozzá tárcákat (ETH/SOL/BTC) vagy nyomd meg a Demó gombot — mind egy közös portfólióban, valós árfolyamon.",
                       "Add wallets (ETH/SOL/BTC) or press Demo — all in one combined portfolio at live prices."],
  "footer.disclaimer": ["Tájékoztató tárca-áttekintő eszköz — nem adóbevallás. A fiat-váltás tőzsdén történik, on-chain nem látszik; az „akkori árfolyam” tájékoztató becslés a CoinGecko napi árfolyamából (USD és HUF). A gas-t a tranzakció küldője fizeti. Adatforrások: Blockscout (multichain holdings), Etherscan (aktivitás/gas), Helius/Solana-RPC (SOL), mempool.space (BTC), CoinGecko (árfolyam).",
                        "Informational wallet-overview tool — not tax advice. Fiat conversion happens on exchanges and isn't visible on-chain; the “price then” is an informational estimate from CoinGecko daily rates (USD and HUF). Gas is paid by the transaction sender. Data sources: Blockscout (multichain holdings), Etherscan (activity/gas), Helius/Solana RPC (SOL), mempool.space (BTC), CoinGecko (prices)."],
  "res.walletsMerged": ["{n} tárca összevonva", "{n} wallets merged"],
  "res.wallet": ["Tárca", "Wallet"],
  "res.totalValue": ["Portfólió összérték (multichain)", "Total portfolio value (multichain)"],
  "btn.print": ["PDF / Nyomtatás", "PDF / Print"],
  "pf.loading": ["Multichain portfólió betöltése (Blockscout, 6 lánc)…", "Loading multichain portfolio (Blockscout, 6 chains)…"],
  "pf.title": ["Portfólió — {n} eszköz, {c} lánc", "Portfolio — {n} assets, {c} chains"],
  "pf.priceSrc": ["ár-forrás", "price source"],
  "pf.src.coingecko": ["CoinGecko (teljes)", "CoinGecko (full)"],
  "pf.src.allowlist": ["curated allowlist (keyless)", "curated allowlist (keyless)"],
  "pf.dustFiltered": ["{n} spam/dust szűrve", "{n} spam/dust filtered"],
  "pf.chainDown": ["{c} lánc most nem elérhető", "{c} chain currently unavailable"],
  "pf.total": ["Összérték", "Total"],
  "pf.emptyList": ["Nincs megjeleníthető token ezen a láncon/címen.", "No tokens to show for this chain/address."],
  "pf.priceUnverified": ["≈ ár?", "≈ price?"],
  "pf.priceUnverifiedTip": ["Az árat nem tudtuk megbízhatóan igazolni — nincs a portfólió-összegben",
                            "Price could not be reliably verified — not included in the portfolio total"],
  "pf.unverifiedNote": ["≈ {n} token árát nem tudtuk megbízhatóan igazolni (a mennyiség valós, de NEM számítottuk a portfólió-értékbe).",
                        "≈ {n} tokens' price could not be reliably verified (amount is real, but NOT counted in the portfolio value)."],
  "pf.cgHint": ["Saját ingyenes CoinGecko-kulccsal ezek is pontosan árazódnak.", "With your own free CoinGecko key these are priced accurately too."],
  "pf.suspicious": ["{n} gyanús (hamis-árú) token kiszűrve.", "{n} suspicious (fake-price) tokens filtered out."],
  "pf.oversizedNative": ["⚠ Szokatlanul nagy native-egyenleg ({v}) van az összegben — valós on-chain adat, de ellenőrizd (whale / csere-hidegtárca / esetleges elszámolási hiba).",
                         "⚠ An unusually large native balance ({v}) is included in this total — it is real on-chain data, but verify it (whale / exchange cold wallet / possible accounting anomaly)."],
  "pf.oversizedBadge": ["ellenőrizd", "verify"],
  "pf.oversizedTip": ["Szokatlanul nagy egyenleg — valós lánc-adat, de érdemes ellenőrizni.",
                      "Unusually large balance — real chain data, but worth verifying."],
  "pf.truncated": ["⚠ A holdings-lista csonkítva lehet (nagyon sok token/NFT a lapozás-limit felett) — a total ennek egy részét nem tartalmazza.",
                   "⚠ Holdings list may be truncated (very many tokens/NFTs beyond the page limit) — the total may omit some of it."],
  "pf.csv": ["CSV export", "CSV export"],
  "nft.title": ["NFT-galéria", "NFT gallery"],
  "nft.count": ["{n} NFT", "{n} NFTs"],
  "nft.none": ["Nincs NFT ezeken a láncokon.", "No NFTs on these chains."],
  "wl.title": ["Figyelt tárcák", "Watched wallets"],
  "mock.notice": ["A token-portfólió (multichain) VALÓS, kulcs nélkül. Az aktivitás/gas-oldal most demó-adat — élő on-chain aktivitáshoz add meg a saját VITE_ETHERSCAN_KEY-t (ingyenes).",
                  "The multichain token portfolio is REAL, keyless. The activity/gas page is demo data now — for live on-chain activity add your own VITE_ETHERSCAN_KEY (free)."],
  "pf.sourceUnavailable": ["A portfólió-adatforrás most nem elérhető (Blockscout). Próbáld újra kicsit később — nem mutatunk kitalált értéket.",
                           "Portfolio data source is currently unavailable (Blockscout). Try again shortly — we never show fabricated values."],
  "pf.noHoldings": ["Ezeken a láncokon nem találtunk eszközt ehhez a tárcához.", "No assets found for this wallet on these chains."],
  "pf.other": ["Egyéb", "Other"],
  "pf.coverage": ["⚠ {covered}/{total} eszköz ára ellenőrzött (a headline-totál csak ezekből). ~{uncovered} értékű token ára nem igazolható kulcs nélkül, ezért NINCS a portfólió-összegben.",
                  "⚠ {covered}/{total} assets are price-verified (the headline total counts only these). ~{uncovered} worth of tokens can't be priced without a key, so they're NOT in the portfolio total."],
  "price.degraded": ["⚠ Az ársor most hiányos vagy 365 napra vágott (rate-limit / keyless korlát) — a régebbi tx-ek USD/HUF becslése megbízhatatlan; az ETH-mennyiségek pontosak.",
                     "⚠ Price series is currently incomplete or capped at 365 days (rate-limit / keyless limit) — USD/HUF estimates for older txs are unreliable; ETH amounts are exact."],
  "metric.gasBurned": ["Elégetett gas összesen", "Total gas burned"],
  "metric.gasSub": ["a te tranzakcióid díja", "fees for your transactions"],
  "metric.inflow": ["Beérkezett (ETH, akkori árf.)", "Received (ETH, price then)"],
  "metric.outflow": ["Kiment (ETH, akkori árf.)", "Sent (ETH, price then)"],
  "metric.txs": ["Tranzakciók", "Transactions"],
  "metric.tokenTransfers": ["{n} token-transzfer", "{n} token transfers"],
  "metric.firstTx": ["Első tx", "First tx"],
  "metric.lastTx": ["Utolsó tx", "Last tx"],
  "metric.mostActive": ["Legaktívabb hónap", "Most active month"],
  "cf.title": ["Havi ETH-cashflow ({cur})", "Monthly ETH cashflow ({cur})"],
  "cf.received": ["Beérkezett", "Received"],
  "cf.sent": ["Kiment", "Sent"],
  "cf.empty": ["Nincs native ETH cashflow ehhez a tárcához.", "No native ETH cashflow for this wallet."],
  "story.title": ["A tárcád története", "Your wallet's story"],
  "story.body": ['Ez a tárca <b class="text-white">{date}</b> óta él — közel <b class="text-white">{years} éve</b>. Azóta <b class="text-white">{tx}</b> tranzakciót indított, összesen <b class="cyan-text">{gas}</b>-t fizetett gas-ban, és <b class="text-white">{inflow}</b> értékű ETH érkezett be az akkori árfolyamokon.',
                 'This wallet has been active since <b class="text-white">{date}</b> — nearly <b class="text-white">{years} years</b>. Since then it made <b class="text-white">{tx}</b> transactions, paid <b class="cyan-text">{gas}</b> in gas, and received <b class="text-white">{inflow}</b> worth of ETH at the prices then.'],
  "story.activeMonth": ['A legaktívabb hónap <b class="text-white">{month}</b> volt ({count} tx).',
                        'The most active month was <b class="text-white">{month}</b> ({count} txs).'],
  "story.shareReal": ["Oszd meg egy képernyőképpel — a számok a valós on-chain aktivitásból származnak.",
                      "Share it with a screenshot — the numbers come from real on-chain activity."],
  "story.shareSample": ["Minta/demó adat (nem valós on-chain aktivitás) — élő számokhoz add meg a VITE_ETHERSCAN_KEY-t.",
                        "Sample/demo data (not real on-chain activity) — add VITE_ETHERSCAN_KEY for live numbers."],
  "cp.title": ["Leggyakoribb partnerek", "Top counterparties"],
  "approvals.title": ["Biztonsági — token-engedélyek (approvals)", "Security — token approvals"],
  "approvals.body": ["Az aktív ERC-20/NFT engedélyek (mit engedélyeztél és kinek) a pénzed legnagyobb rejtett kockázata. Ellenőrizd és vond vissza egy kattintással a vezető ingyenes eszközön — a címed előre kitöltve. (A teljes in-app engedély-lista később jön; kitalált adatot itt nem mutatunk.)",
                     "Active ERC-20/NFT approvals (what you allowed and to whom) are your biggest hidden risk. Check and revoke in one click on the leading free tool — your address is pre-filled. (Full in-app allowance list comes later; we show no fabricated data here.)"],
  "approvals.cta": ["Engedélyek ellenőrzése a revoke.cash-en →", "Check approvals on revoke.cash →"],
  "tx.title": ["Tranzakciók", "Transactions"],
  "tx.all": ["Mind", "All"],
  "tx.in": ["Be", "In"],
  "tx.out": ["Ki", "Out"],
  "tx.date": ["Dátum", "Date"],
  "tx.direction": ["Irány", "Direction"],
  "tx.asset": ["Eszköz", "Asset"],
  "tx.amount": ["Mennyiség", "Amount"],
  "tx.value": ["Érték", "Value"],
  "tx.dirIn": ["↓ be", "↓ in"],
  "tx.dirOut": ["↑ ki", "↑ out"],
  "tx.failed": ["hibás", "failed"],
  "tx.priceUnavail": ["ár nem elérhető", "price unavailable"],
  "tx.truncated": ["Az első 60 sor látszik ({n} összesen).", "Showing first 60 rows ({n} total)."],
  "wl.sub": ["watch-only · perzisztens (localStorage)", "watch-only · persistent (localStorage)"],
  "wl.addrPlaceholder": ["Cím: 0x… / SOL base58 / bc1…", "Address: 0x… / SOL base58 / bc1…"],
  "wl.labelPlaceholder": ["Címke (pl. Fő tárca)", "Label (e.g. Main wallet)"],
  "wl.empty": ["Adj hozzá egy vagy több címet (ETH/SOL/BTC) — mind egy közös portfólióban látszik, valós árfolyamon.",
               "Add one or more addresses (ETH/SOL/BTC) — all shown in one combined portfolio at live prices."],
  "wl.rename": ["Átnevezés", "Rename"],
  "wl.remove": ["Törlés", "Remove"],
  "wl.priceNa": ["ár n/a", "price n/a"],
  "wl.priceNaTip": ["A tárcának van eszköze, de az ár most nem igazolható (kulcs nélkül / rate-limit) — nem a totálban.",
                    "Wallet holds assets, but the price can't be verified now (keyless / rate-limit) — not in the total."],
  "wl.walletError": ["hiba", "error"],
  "wl.walletErrorTip": ["A tárca adatait most nem sikerült lekérni (lánc-hiba / rate-limit) — nem $0, hanem ismeretlen.",
                        "Could not fetch this wallet's data now (chain error / rate-limit) — not $0, just unknown."],
  "wl.defaultLabel.evm": ["EVM tárca {n}", "EVM wallet {n}"],
  "wl.defaultLabel.sol": ["Solana tárca {n}", "Solana wallet {n}"],
  "wl.defaultLabel.btc": ["Bitcoin tárca {n}", "Bitcoin wallet {n}"],
  "err.unknownFormat": ["Ismeretlen cím-formátum (ETH 0x… / SOL base58 / BTC bc1…/1…/3…).",
                        "Unknown address format (ETH 0x… / SOL base58 / BTC bc1…/1…/3…)."],
  "err.duplicate": ["Ez a cím már a listán van.", "This address is already in the list."],
  "tx.truncatedActivity": ["⚠ A tranzakció-előzmény csonkítva (lapozás-limit vagy hiba) — az elégetett gas és a be/kimenő ETH ennek egy részét nem tartalmazza, azaz alábecsülhet.",
                           "⚠ Transaction history is truncated (page limit or error) — burned gas and in/out ETH may omit part of it, i.e. can undercount."],
};

export function t(key: string, vars?: Record<string, string | number>): string {
  const e = DICT[key];
  let s = e ? (getLang() === "en" ? e[1] : e[0]) : key;
  if (vars) for (const k in vars) s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(vars[k]));
  return s;
}

// Hook: a komponens újrarendel nyelvváltáskor, és visszaadja a t() fordítót.
export function useT() { useLang(); return t; }
