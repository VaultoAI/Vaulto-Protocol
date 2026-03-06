# Token Logo Implementation Guide

This guide explains how token logos are fetched and loaded in the Vaulto-Earn application and how to duplicate this functionality in an independent external application.

---

## 1. Overview

The app supports **two chains** for token logos:

| Chain   | Source                    | Resolution                          |
|--------|---------------------------|-------------------------------------|
| **EVM** (Ethereum, Polygon, BSC, etc.) | TrustWallet Assets (GitHub) | URL from `chainId` + token address |
| **Solana** | Local mapping + static files | Mint address → path in `/public/solana/` |

EVM logos are **fetched by URL** (and optionally verified with a HEAD request). Solana logos are **resolved from a static map** and served from your own `public/` (or equivalent) assets.

---

## 2. Data Flow

```
Token (address, chain, symbol)
        │
        ├── chain === 'SOLANA'
        │       → getSolanaTokenLogoUrl(mint) → local path or null
        │
        └── chain === 'ETHEREUM' (or other EVM)
                → getTokenLogoUrl(address, chainId) → TrustWallet URL
                → useTokenLogo hook: optional verifyLogoExists(HEAD) + React Query cache
                → Component uses URL or fallback
```

The **Token** type used by the UI:

```ts
interface Token {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  address: string;   // contract address (EVM) or mint address (Solana)
  chain: string;     // 'ETHEREUM' | 'SOLANA'
  logoURI?: string;  // optional; app often overwrites with resolved logo URL
}
```

---

## 3. EVM (Ethereum and other EVM chains)

### 3.1 Source: TrustWallet Assets

- **Repository:** https://github.com/trustwallet/assets  
- **URL pattern:**  
  `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chainName}/assets/{checksummedAddress}/logo.png`

- **Chain ID → chain name** (as used in this app):

| chainId | chainName   |
|---------|-------------|
| 1       | ethereum    |
| 137     | polygon    |
| 56      | smartchain |
| 43114   | avalanche  |
| 250     | fantom     |
| 42161   | arbitrum   |
| 10      | optimism   |
| 8453    | base       |

- **Address:** Must be **checksummed** (EIP-55). Use a library (e.g. `viem`’s `getAddress`) so the path is correct.

### 3.2 Core logic (framework-agnostic)

```ts
const CHAIN_NAME_MAP: Record<number, string> = {
  1: 'ethereum',
  137: 'polygon',
  56: 'smartchain',
  43114: 'avalanche',
  250: 'fantom',
  42161: 'arbitrum',
  10: 'optimism',
  8453: 'base',
};

function getChainName(chainId: number): string {
  return CHAIN_NAME_MAP[chainId] ?? 'ethereum';
}

// Requires a way to checksum (e.g. getAddress from viem or ethers)
function getTrustWalletLogoUrl(
  tokenAddress: string,
  chainId: number = 1
): string {
  const checksummedAddress = getAddress(tokenAddress); // viem
  const chainName = getChainName(chainId);
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chainName}/assets/${checksummedAddress}/logo.png`;
}
```

- **Validation:** Ensure the address is valid (e.g. `isAddress` from viem) before building the URL; return empty string or throw if invalid.
- **Sync API:** The app exposes a **synchronous** `getTokenLogoUrl(address, chainId)` that **always returns this URL** (no fetch). The UI then loads the image and handles 404 via `onError`.

### 3.3 Optional: verify logo exists (async)

To avoid showing broken images, you can **verify** the URL with a HEAD request and cache the result:

```ts
const logoCache = new Map<string, string | null>();

async function fetchTrustWalletLogo(
  tokenAddress: string,
  chainId: number = 1
): Promise<string | null> {
  const cacheKey = `${chainId}:${tokenAddress.toLowerCase()}`;
  if (logoCache.has(cacheKey)) {
    return logoCache.get(cacheKey) ?? null;
  }

  const logoUrl = getTrustWalletLogoUrl(tokenAddress, chainId);
  try {
    const res = await fetch(logoUrl, { method: 'HEAD' });
    if (res.ok) {
      logoCache.set(cacheKey, logoUrl);
      return logoUrl;
    }
  } catch {
    // ignore
  }
  logoCache.set(cacheKey, null);
  return null;
}

async function verifyLogoExists(logoUrl: string): Promise<boolean> {
  if (!logoUrl) return false;
  try {
    const res = await fetch(logoUrl, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}
```

- **CORS:** TrustWallet’s raw GitHub URLs work from the browser for `<img>` and `fetch(..., { method: 'HEAD' })`; no backend proxy is required for this.

---

## 4. Solana

### 4.1 Source: Local mapping + static files

- **No external API.** A **static map** in code maps **mint address → path** (relative to the app’s public/static root).
- **Files** live under `public/solana/` (Next.js) or your framework’s static asset root; paths in the map are like `/solana/anduril.webp`.

Example map (mint → path):

```ts
const SOLANA_TOKEN_LOGOS: Record<string, string> = {
  'PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB': '/solana/anduril.webp',
  'PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF': '/solana/openai.webp',
  'So11111111111111111111111111111111111111112': '/solana/solana-sol-logo-png_seeklogo-423095.png',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': '/solana/USD_Coin_logo.png',
  // ... more entries
};

function getSolanaTokenLogoUrl(tokenMint: string): string | null {
  if (!tokenMint) return null;
  const normalizedMint = tokenMint.trim();
  return SOLANA_TOKEN_LOGOS[normalizedMint] ?? null;
}
```

- **Normalization:** Use `.trim()` and optionally lowercase if you ever mix casing; the current app uses the mint as-is (case-sensitive in the map).
- In an external app, **paths** should match your static server (e.g. `/solana/...` if served from root, or `https://your-cdn.com/solana/...` if you use absolute URLs).

---

## 5. UI Component Behavior

The app’s **TokenLogo** component:

1. **Branch by chain**
   - **Solana:** `logoUrl = getSolanaTokenLogoUrl(token.address)` (sync).
   - **EVM:** `logoUrl = useTokenLogo({ tokenAddress, chainId })` (hook that may call `verifyLogoExists` and caches with React Query).

2. **Render**
   - If no `logoUrl` or loading (EVM) or image error: show a **fallback** (e.g. circle with first letter of `token.symbol` or `'?'`).
   - Otherwise: render an `<img>` (or Next.js `<Image>`) with `src={logoUrl}`, `onError` → set error state and show fallback, `onLoad` → optional loading state.

3. **Sizing**
   - Single `size` prop (e.g. 24 or 40) applied to container and image (width/height).

4. **Next.js note**
   - The app uses `unoptimized: true` for images, so the TrustWallet URL is used as-is; no `remotePatterns` are required for that. If you enable optimization, you’d add the TrustWallet domain to `images.remotePatterns`.

To duplicate in another app (e.g. React without Next):

- Use the same **resolution logic** (EVM vs Solana, same URLs and map).
- Use a normal `<img>` with `src={logoUrl}`, `onError` / `onLoad`, and the same fallback (letter or “?”).
- Optional: a small cache (in-memory or React Query) for `verifyLogoExists` so you don’t repeat HEAD requests.

---

## 6. Where logo URLs are set on tokens

The app often attaches the resolved logo to the token as `logoURI` when building pool/token lists, so other code can use `token.logoURI` instead of resolving again:

- **EVM:** `logoURI: getTokenLogoUrl(token0Address, chainId)` (and same for token1).
- **Solana:** `logoURI: getSolanaTokenLogoUrl(mint) ?? ''`.

So in addition to the **TokenLogo** component (which can resolve from `address` + `chain`), tokens in pools/hooks are often pre-filled with `logoURI`. An external app can do the same: either resolve at display time or when building the token list.

---

## 7. Checklist for an external application

- [ ] **Token type**  
  At least: `address`, `chain` (`'ETHEREUM'` or `'SOLANA'`), `symbol` (for fallback).

- [ ] **EVM**
  - [ ] Implement `getTokenLogoUrl(address, chainId)` using TrustWallet URL pattern and checksummed address.
  - [ ] (Optional) Implement `verifyLogoExists(url)` and cache (e.g. in-memory or React Query) to avoid showing 404.
  - [ ] Support the same `CHAIN_NAME_MAP` (or subset) you need.

- [ ] **Solana**
  - [ ] Add a `SOLANA_TOKEN_LOGOS` map (mint → path).
  - [ ] Serve the actual image files from your static asset root (e.g. `public/solana/`).
  - [ ] Implement `getSolanaTokenLogoUrl(mint)` with normalization.

- [ ] **UI**
  - [ ] One component that takes `token` + `size` (and optional `className`).
  - [ ] If Solana → use Solana logo URL; else → use EVM logo URL (from sync getter or from async hook).
  - [ ] Fallback: circle with `symbol[0]` or `'?'` when no URL, loading, or image error.
  - [ ] Use `<img>` (or framework’s Image) with `onError` / `onLoad` and fixed dimensions.

- [ ] **CORS / domains**
  - TrustWallet raw GitHub URLs work from the browser; no proxy needed for `<img>` or HEAD. If you use Next.js image optimization, add the TrustWallet domain to `images.remotePatterns`.

- [ ] **Dependencies (EVM)**
  - A way to **checksum** addresses (e.g. `viem`: `getAddress`, `isAddress`). No other external API is required for the logo URL itself.

---

## 8. File reference (in this repo)

| Purpose                     | File |
|----------------------------|------|
| EVM logo URL + verify + cache | `lib/utils/tokenLogo.ts` |
| Solana logo map + getter    | `lib/utils/solanaTokenLogo.ts` |
| React hook (EVM, with verify) | `hooks/useTokenLogo.ts` |
| Token type                  | `lib/pools/types.ts` (`Token`) |
| Display component           | `components/TokenLogo.tsx` |
| Solana assets               | `public/solana/*` |

---

## 9. Token addresses with displayed pools

The following tokens have pools that are currently displayed on the site. Use these addresses when resolving logos or building an external token list.

### 9.1 EVM (Ethereum mainnet, chainId 1)

| Symbol   | Token address |
|----------|----------------|
| USDC     | `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48` |
| SLVon    | `0xf3e4872e6a4cf365888d93b6146a2baa7348f1a4` |
| CRCLon   | `0x3632dea96a953c11dac2f00b4a05a32cd1063fae` |
| NVDAon   | `0x2d1f7226bd1f780af6b9a49dcc0ae00e8df4bdee` |
| TSLAon   | `0xf6b1117ec07684d3958cad8beb1b302bfd21103f` |
| SPYon    | `0xfedc5f4a6c38211c1338aa411018dfaf26612c08` |
| QQQon    | `0x0e397938c1aa0680954093495b70a9f5e2249aba` |
| GOOGLon  | `0xba47214edd2bb43099611b208f75e4b42fdcfedc` |
| BABAon   | `0x41765f0fcddc276309195166c7a62ae522fa09ef` |
| TLTon    | `0x992651bfeb9a0dcc4457610e284ba66d86489d4d` |
| AAPLon   | `0x14c3abf95cb9c93a8b82c1cdcb76d72cb87b2d4c` |
| COINon   | `0xf042cfa86cf1d598a75bdb55c3507a1f39f9493b` |
| HOODon   | `0x998f02a9e343ef6e3e6f28700d5a20f839fd74e6` |
| MSFTon   | `0xb812837b81a3a6b81d7cd74cfb19a7f2784555e5` |
| MSTRon   | `0xcabd955322dfbf94c084929ac5e9eca3feb5556f` |
| NKEon    | `0xd8e26fcc879b30cb0a0b543925a2b3500f074d81` |
| SPGIon   | `0xbc843b147db4c7e00721d76037b8b92e13afe13f` |

*Source: `lib/cache/poolFetchers.ts` (TOKENIZED_STOCK_ADDRESSES) and USDC constant. All are Ethereum mainnet.*

### 9.2 Solana

| Symbol   | Mint address |
|----------|----------------|
| SOL      | `So11111111111111111111111111111111111111112` |
| USDC     | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| USDT     | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` |
| ANDURIL  | `PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB` |
| OPENAI   | `PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF` |
| SPACEX   | `PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh` |
| xAI      | `PreC1KtJ1sBPPqaeeqL6Qb15GTLCYVvyYEwxhdfTwfx` |
| ANTHROPIC | `Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw` |

*Source: `lib/utils/solanaTokenLogo.ts` (SOLANA_TOKEN_LOGOS, SOLANA_TOKEN_NAMES) and `lib/cache/poolFetchers.ts` (SOLANA_COMMON_TOKENS). SOL, USDC, USDT are common pair tokens; the rest are tracked prestock tokens with pools.*

---

## 10. Minimal standalone example (pseudo-code)

```ts
// 1) EVM URL (sync)
function getEvmLogoUrl(address: string, chainId: number): string {
  const chainNames: Record<number, string> = {
    1: 'ethereum', 137: 'polygon', 56: 'smartchain',
    42161: 'arbitrum', 10: 'optimism', 8453: 'base',
  };
  const chain = chainNames[chainId] ?? 'ethereum';
  const checksummed = getAddress(address); // viem
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chain}/assets/${checksummed}/logo.png`;
}

// 2) Solana URL (sync, from your map + static files)
function getSolanaLogoUrl(mint: string): string | null {
  const map: Record<string, string> = {
    'So11111111111111111111111111111111111111112': '/solana/sol.png',
    // ...
  };
  return map[mint.trim()] ?? null;
}

// 3) Resolve for display
function getTokenLogoUrl(token: Token): string | null {
  if (token.chain === 'SOLANA') return getSolanaLogoUrl(token.address);
  if (token.chain === 'ETHEREUM') return getEvmLogoUrl(token.address, 1);
  return null;
}

// 4) Component: render <img src={url} onError={setError} /> or fallback letter.
```

This gives you the same behavior as the app: EVM logos from TrustWallet, Solana from your own map and static files, with a simple fallback in the UI. For a list of all token addresses that have displayed pools, see **§9. Token addresses with displayed pools**.
