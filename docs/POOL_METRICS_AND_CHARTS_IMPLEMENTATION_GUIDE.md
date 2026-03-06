# Pool Metrics and Charts Implementation Guide

This guide details how the Vaulto-Earn application fetches key pool metrics (TVL, 24h/30d volume, fees) and builds the **price graph** and **volume traded** chart for the underlying token of a pool. Use it to duplicate this functionality in an independent external application.

---

## 1. Overview

| Chain   | Data source              | TVL | 24h volume | 30d volume | Price history | Volume chart |
|--------|---------------------------|-----|-------------|-------------|----------------|--------------|
| **EVM** (Ethereum) | Uniswap V3 subgraph (GraphQL) | ✅ `totalValueLockedUSD` | ✅ from `poolHourData` or `poolDayData[0]` | ✅ sum of `poolDayData` (30 days) | ✅ from `poolDayData.token0Price` / `token1Price` | ✅ `poolDayData.volumeUSD` |
| **Solana** | Meteora DLMM API (REST) | ✅ `liquidity` | ✅ `trade_volume_24h` | ⚠️ 24h × 30 estimate | ✅ `current_price` only (no history) | ⚠️ single point |

- **EVM**: Full time-series from Uniswap V3 subgraph (daily + optional hourly). Price and volume charts use the same `poolDayData` (and optionally `poolHourData` for accurate 24h).
- **Solana**: Meteora provides current TVL, 24h volume/fees, and current price. No historical OHLCV; 30d is approximated.

---

## 2. Key metrics summary

| Metric | EVM source | Solana source |
|--------|------------|----------------|
| **TVL** | `pool.totalValueLockedUSD` | `pool.liquidity` (USD string) |
| **24h volume** | Rolling 24h from `poolHourData` (or `poolDayData[0].volumeUSD`) | `pool.trade_volume_24h` |
| **30d volume** | `sum(poolDayData[].volumeUSD)` (first 30 days) | `trade_volume_24h * 30` (estimate) |
| **24h fees** | Rolling 24h from `poolHourData` (or `poolDayData[0].feesUSD`) | `pool.fees_24h` |
| **30d fees** | `sum(poolDayData[].feesUSD)` | `fees_24h * 30` (estimate) |
| **APR** | `(fees30d * 12 / tvl) * 100` | Same formula using estimated 30d fees |
| **TVL 24h change %** | `(dayData[0].tvlUSD - dayData[1].tvlUSD) / dayData[1].tvlUSD * 100` | N/A (no daily history) |
| **Price (chart)** | Per-day from `poolDayData.token0Price` / `token1Price` (stablecoin-adjusted) | `pool.current_price` (one point) |

---

## 3. EVM: Uniswap V3 Subgraph

### 3.1 Endpoint and auth

- **Base URL (The Graph Gateway):**  
  `https://gateway.thegraph.com/api/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV`
- **Subgraph ID:** `5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV` (Uniswap V3 Ethereum).
- **Auth:** Optional. For higher rate limits, set `Authorization: Bearer <API_KEY>`. API key from [The Graph Studio](https://thegraph.com/studio/apikeys/). Env: `NEXT_PUBLIC_THE_GRAPH_API_KEY` or `THE_GRAPH_API_KEY`.
- **CORS:** In browser apps, call your own backend and proxy the request to the Gateway (same as this app’s `/api/graphql`).

### 3.2 Pool list query (TVL, 24h, 30d volume/fees)

Used for tables and “pools by token” views. Request one pool per token (or more) and derive metrics from `poolDayData` and optionally `poolHourData`.

**Variables:**

- `first`: number of pools per token (e.g. 20).
- `tokenAddress`: token contract address in **lowercase** (e.g. `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`).

**Query (GraphQL):**

```graphql
query TopV3Pools($first: Int!, $tokenAddress: String!) {
  pools(
    first: $first
    where: {
      or: [
        { token0_: { id: $tokenAddress } }
        { token1_: { id: $tokenAddress } }
      ]
    }
    orderBy: totalValueLockedUSD
    orderDirection: desc
  ) {
    id
    token0 { id symbol name decimals }
    token1 { id symbol name decimals }
    feeTier
    totalValueLockedUSD
    txCount
    poolDayData(
      orderBy: date
      orderDirection: desc
      first: 30
    ) {
      date
      volumeUSD
      feesUSD
      tvlUSD
    }
    poolHourData(
      orderBy: periodStartUnix
      orderDirection: desc
      first: 49
    ) {
      periodStartUnix
      volumeUSD
      feesUSD
    }
  }
}
```

**Notes:**

- Token `id` in the subgraph is `{address}-{chainId}` (e.g. `0xa0b...eb48-1`). Use `token0.id.split('-')[0]` for the contract address.
- `pool.id` is the pool contract address (lowercase).
- `poolDayData` is **descending by date** (most recent first). First 30 entries = last 30 days.
- `poolHourData`: 49 hours gives enough for a rolling 24h window (current 24h + previous 24h for comparison).

### 3.3 Deriving EVM metrics from the list query

**TVL:**

```ts
const tvl = parseFloat(pool.totalValueLockedUSD || '0');
```

**24h volume and 24h fees:**

- **Preferred:** From `poolHourData` (rolling 24h):
  - `now = floor(Date.now() / 1000)`
  - `twentyFourHoursAgo = now - 24 * 3600`
  - Sum `volumeUSD` and `feesUSD` for all hours with `periodStartUnix >= twentyFourHoursAgo`.
- **Fallback:** If no hourly data, use the most recent day: `poolDayData[0].volumeUSD` and `poolDayData[0].feesUSD`.

**30d volume and 30d fees:**

```ts
const volume30d = pool.poolDayData.reduce((sum, day) => sum + parseFloat(day.volumeUSD || '0'), 0);
const fees30d = pool.poolDayData.reduce((sum, day) => sum + parseFloat(day.feesUSD || '0'), 0);
```

**TVL 24h change %:**

```ts
if (pool.poolDayData.length >= 2) {
  const current = parseFloat(pool.poolDayData[0].tvlUSD || '0');
  const previous = parseFloat(pool.poolDayData[1].tvlUSD || '0');
  if (previous > 0 && current > 0) {
    tvl24HChange = ((current - previous) / previous) * 100;
  }
}
```

**APR:**

```ts
// fees30d and tvl from above
const apr = tvl > 0 ? (fees30d * 12 / tvl) * 100 : 0;
```

### 3.4 Pool details query (single pool: TVL, volume, price history, chart)

Used for the pool detail page: full metrics + **price and volume time-series** for the chart.

**Variables:**

- `poolId`: pool contract address (lowercase), e.g. `0x...`.

**Query (GraphQL):**

```graphql
query PoolDetails($poolId: ID!) {
  pool(id: $poolId) {
    id
    token0 { id symbol name decimals }
    token1 { id symbol name decimals }
    feeTier
    totalValueLockedUSD
    txCount
    token0Price
    token1Price
    poolDayData(
      orderBy: date
      orderDirection: desc
      first: 30
    ) {
      date
      volumeUSD
      feesUSD
      tvlUSD
      token0Price
      token1Price
      open
      high
      low
      close
    }
    poolHourData(
      orderBy: periodStartUnix
      orderDirection: desc
      first: 49
    ) {
      periodStartUnix
      volumeUSD
      feesUSD
    }
  }
}
```

Same 24h/30d derivation rules as above. In addition, use `poolDayData` to build the **price and volume chart**.

---

## 4. Price graph (underlying token price)

### 4.1 Source of truth

- **EVM:** Pool’s `poolDayData` with `token0Price` and `token1Price`. No external stock or oracle API.
- **Solana:** Only `current_price` from Meteora (no history).

### 4.2 Uniswap V3 price semantics

- `token0Price`: price of **token0 in terms of token1** (how many token1 per 1 token0).
- `token1Price`: price of **token1 in terms of token0**.

For a **USDC/token** pool, the “underlying token” is the non-stablecoin. You want that token’s price in USD (i.e. in USDC terms).

**Stablecoin addresses (Ethereum mainnet):**

- USDC: `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`
- USDT: `0xdac17f958d2ee523a2206206994597c13d831ec7`
- DAI: `0x6b175474e89094c44da98b954eedeac495271d0f`

**Price per day (USD for the non-stablecoin):**

- If **token1** is stablecoin: use `token1Price` → “USDC per 1 token0” = token0 price in USD.
- If **token0** is stablecoin: use `token0Price` → token1 price in USD.
- If neither is stablecoin: use `token0Price` as the charted price (relative).

**Fallback:** If `token0Price`/`token1Price` are missing, use `poolDayData[].close`.

### 4.3 Building the chart time-series (EVM)

Each point in the chart is one day. Build an array (oldest to newest for plotting):

```ts
interface TVLDataPoint {
  date: number;      // Unix timestamp (day)
  tvlUSD: number;
  volumeUSD: number;
  price: number;     // Underlying token price in USD (or ratio)
}

// dayData = pool.poolDayData, descending (newest first)
const dayData = pool.poolDayData || [];
const isToken0Stable = [USDC, USDT, DAI].includes(pool.token0.id.split('-')[0].toLowerCase());
const isToken1Stable = [USDC, USDT, DAI].includes(pool.token1.id.split('-')[0].toLowerCase());

const tvlHistory: TVLDataPoint[] = [...dayData]
  .reverse()   // chronological: oldest → newest
  .map((day) => {
    let price = 0;
    if (day.token0Price && day.token1Price) {
      const p0 = parseFloat(day.token0Price);
      const p1 = parseFloat(day.token1Price);
      if (isToken1Stable && p1 > 0) price = p1;       // token0 in USD
      else if (isToken0Stable && p0 > 0) price = p0;   // token1 in USD
      else if (p0 > 0) price = p0;
    }
    if (price === 0 && day.close) price = parseFloat(day.close);
    return {
      date: day.date,
      tvlUSD: parseFloat(day.tvlUSD || '0'),
      volumeUSD: parseFloat(day.volumeUSD || '0'),
      price,
    };
  })
  .filter((p) => p.tvlUSD > 0);
```

This `tvlHistory` is what the app uses for:
- **Price line:** `point.price`
- **Volume bars:** `point.volumeUSD`
- **TVL (optional):** `point.tvlUSD`

---

## 5. Volume traded (chart)

- **EVM:** Same `tvlHistory[].volumeUSD` from `poolDayData.volumeUSD` (one value per day). For a **24h volume** number (not chart), use the rolling 24h sum from `poolHourData` as in §3.3.
- **Solana:** Meteora only has `trade_volume_24h`; the app shows a single “current” point (no historical volume series).

Chart data = same array as the price graph: one entry per day with `date`, `volumeUSD`, `price`, `tvlUSD`.

---

## 6. 24h metrics from hourly data (EVM)

For accurate **rolling** 24h volume and fees (instead of “current calendar day” from `poolDayData[0]`), use `poolHourData`:

```ts
function calculate24hMetrics(
  hourlyData: Array<{ periodStartUnix: number; volumeUSD: string; feesUSD: string }>
) {
  const now = Math.floor(Date.now() / 1000);
  const twentyFourHoursAgo = now - 24 * 3600;
  const currentPeriod = hourlyData.filter((h) => h.periodStartUnix >= twentyFourHoursAgo);
  const volume24h = currentPeriod.reduce((s, h) => s + parseFloat(h.volumeUSD || '0'), 0);
  const fees24h = currentPeriod.reduce((s, h) => s + parseFloat(h.feesUSD || '0'), 0);
  return { volume24h, fees24h };
}
```

Request at least 48 hours of `poolHourData` if you also want a “previous 24h” comparison (e.g. fees change).

---

## 7. Solana: Meteora DLMM API

### 7.1 Endpoint

- **Base URL:** `https://dlmm-api.meteora.ag`
- **Pool by address:** `GET /pair/{poolAddress}`

No API key in the codebase; public REST.

### 7.2 Response shape (relevant fields)

```ts
{
  address: string;
  name: string;
  mint_x: string;
  mint_y: string;
  liquidity: string;           // TVL USD (string number)
  trade_volume_24h: number;
  fees_24h: number;
  apr: number;
  base_fee_percentage: string;
  current_price: number;
  // ... other fields
}
```

### 7.3 Mapping to app metrics

| App metric | Meteora field |
|-----------|----------------|
| TVL | `parseFloat(pool.liquidity || '0')` |
| 24h volume | `pool.trade_volume_24h` |
| 30d volume | `pool.trade_volume_24h * 30` (estimate) |
| 24h fees | `pool.fees_24h` |
| 30d fees | `pool.fees_24h * 30` (estimate) |
| Current price | `pool.current_price` |
| Price history | Not provided; use a single point for “today” if needed |

For the chart, the app builds a one-point “history”:

```ts
const tvlHistory = tvlUSD > 0 ? [{
  date: Math.floor(Date.now() / 1000),
  tvlUSD,
  volumeUSD: pool.trade_volume_24h || 0,
  price: pool.current_price || 0,
}] : [];
```

---

## 8. Chart component inputs

The app’s **TVLChart** (or equivalent) expects:

- **poolData.tvlHistory:** `TVLDataPoint[]` with `date`, `tvlUSD`, `volumeUSD`, `price`.
- **Pool tokens:** To label axes (e.g. “SLVon Price” when token0 is SLVon and token1 is USDC).

Chart behavior:

- **Price:** Line series from `tvlHistory[].price` (and optional volatility from price returns).
- **Volume:** Bar (or area) from `tvlHistory[].volume`.
- **TVL:** Optional area/line from `tvlHistory[].tvlUSD`.
- **X-axis:** `date` (Unix); format as “Mon DD” or similar.
- **Y-axes:** Separate scales for USD (TVL/volume) and price (or dual axis).

---

## 9. File reference (this repo)

| Purpose | File |
|--------|------|
| Apollo client + proxy | `lib/graphql/client.ts`, `app/api/graphql/route.ts` |
| Pool list query (EVM) | `lib/cache/poolFetchers.ts` (TOP_V3_POOLS_QUERY), `hooks/useWalletPools.ts`, `hooks/usePoolsFromTokenAddress.ts` |
| Pool details query (EVM) | `hooks/usePoolData.ts` (POOL_DETAILS_QUERY), `lib/graphql/queries/poolDetails.graphql` |
| 24h from hourly + 30d sum | `lib/pools/utils.ts` (`calculate24hMetrics`), used in poolFetchers and usePoolData |
| TVL history + price derivation | `hooks/usePoolData.ts` (tvlHistory from poolDayData, stablecoin logic) |
| Types | `lib/pools/types.ts` (`PoolData`, `TVLDataPoint`, `TablePool`) |
| Chart UI | `components/Pools/PoolDetails/TVLChart.tsx` |
| Solana pool data | `hooks/useSolanaPoolData.ts`, Meteora `GET /pair/{address}` |
| Price implementation notes | `POOL_PRICE_IMPLEMENTATION.md` |

---

## 10. Checklist for an external app

**EVM (Uniswap V3):**

- [ ] Configure GraphQL endpoint (Gateway URL + optional Bearer key); use server proxy if in browser.
- [ ] Implement pool list query with `poolDayData` (first: 30, desc) and `poolHourData` (first: 49, desc).
- [ ] TVL from `totalValueLockedUSD`; 24h volume/fees from `calculate24hMetrics(poolHourData)` or `poolDayData[0]`; 30d from sum of `poolDayData`.
- [ ] APR = `(fees30d * 12 / tvl) * 100`; TVL 24h change from first two days of `poolDayData`.
- [ ] Pool details query with `poolDayData` including `token0Price`, `token1Price`, `tvlUSD`, `volumeUSD`, `close`.
- [ ] Stablecoin detection (USDC/USDT/DAI addresses); derive USD price per day from `token0Price`/`token1Price`.
- [ ] Build `tvlHistory` (chronological) for price line and volume chart; filter out zero TVL days.

**Solana (Meteora):**

- [ ] Fetch `GET https://dlmm-api.meteora.ag/pair/{poolAddress}`.
- [ ] Map `liquidity` → TVL, `trade_volume_24h` / `fees_24h` → 24h, 30d = 24h × 30; use `current_price` for a single price point.
- [ ] Optionally build a one-point `tvlHistory` for chart compatibility.

**Charts:**

- [ ] Use `tvlHistory[]` with `date`, `price`, `volumeUSD`, `tvlUSD`; dual axis or separate charts for price vs volume/TVL.
- [ ] Format `date` (Unix) for X-axis; format USD and price for tooltips and axes.

This gives you the same behavior as the app: EVM metrics and price/volume charts from the Uniswap V3 subgraph, and Solana metrics (and a minimal chart) from the Meteora API.
