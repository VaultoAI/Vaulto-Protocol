/**
 * Demo state management for simulated trading.
 * Stores balances in localStorage for persistence across sessions.
 */

const DEMO_STATE_KEY = "vaulto_demo_state";
const DEFAULT_USDC_BALANCE = 10_000;

export interface DemoBalances {
  [symbol: string]: number;
}

export interface DemoState {
  balances: DemoBalances;
  transactions: DemoTransaction[];
}

export interface DemoTransaction {
  id: string;
  timestamp: number;
  type: "swap" | "lend" | "borrow";
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  amountOut: number;
  txHash: string;
}

function generateDemoTxHash(): string {
  const randomHex = Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
  return `0xdemo${randomHex.slice(0, 60)}`;
}

function getInitialState(): DemoState {
  return {
    balances: {
      USDC: DEFAULT_USDC_BALANCE,
    },
    transactions: [],
  };
}

/** Get current demo state from localStorage */
export function getDemoState(): DemoState {
  if (typeof window === "undefined") {
    return getInitialState();
  }
  try {
    const stored = localStorage.getItem(DEMO_STATE_KEY);
    if (!stored) return getInitialState();
    return JSON.parse(stored) as DemoState;
  } catch {
    return getInitialState();
  }
}

/** Save demo state to localStorage */
function saveDemoState(state: DemoState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(state));
  } catch {
    // localStorage might be full or disabled
  }
}

/** Get demo balances */
export function getDemoBalances(): DemoBalances {
  return getDemoState().balances;
}

/** Get balance for a specific token */
export function getDemoBalance(symbol: string): number {
  const balances = getDemoBalances();
  return balances[symbol] ?? 0;
}

/** Update demo balance by adding delta (can be negative) */
export function updateDemoBalance(symbol: string, delta: number): void {
  const state = getDemoState();
  const currentBalance = state.balances[symbol] ?? 0;
  const newBalance = Math.max(0, currentBalance + delta);

  if (newBalance === 0) {
    delete state.balances[symbol];
  } else {
    state.balances[symbol] = newBalance;
  }

  saveDemoState(state);
}

/** Record a demo transaction and update balances */
export function recordDemoTransaction(params: {
  type: "swap" | "lend" | "borrow";
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  amountOut: number;
}): DemoTransaction {
  const state = getDemoState();
  const txHash = generateDemoTxHash();

  const transaction: DemoTransaction = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    txHash,
    ...params,
  };

  // Update balances
  const currentInBalance = state.balances[params.tokenIn] ?? 0;
  state.balances[params.tokenIn] = Math.max(0, currentInBalance - params.amountIn);

  const currentOutBalance = state.balances[params.tokenOut] ?? 0;
  state.balances[params.tokenOut] = currentOutBalance + params.amountOut;

  // Clean up zero balances
  if (state.balances[params.tokenIn] === 0) {
    delete state.balances[params.tokenIn];
  }

  // Keep last 50 transactions
  state.transactions = [transaction, ...state.transactions].slice(0, 50);

  saveDemoState(state);
  return transaction;
}

/** Get demo transaction history */
export function getDemoTransactions(): DemoTransaction[] {
  return getDemoState().transactions;
}

/** Reset demo state to initial values */
export function resetDemoState(): void {
  saveDemoState(getInitialState());
}

/** Check if user has sufficient balance for a demo swap */
export function hasSufficientBalance(symbol: string, amount: number): boolean {
  const balance = getDemoBalance(symbol);
  return balance >= amount;
}
