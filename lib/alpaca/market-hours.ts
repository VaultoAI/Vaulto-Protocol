/**
 * Market Hours Utilities
 *
 * Functions for checking US market trading hours.
 * US markets are open Monday-Friday, 9:30 AM - 4:00 PM Eastern Time.
 */

import type { MarketStatus, AlpacaClock } from "./types";
import { getTradingApiUrl, shouldUseMock } from "./constants";

// Market hours in Eastern Time
const MARKET_OPEN_HOUR = 9;
const MARKET_OPEN_MINUTE = 30;
const MARKET_CLOSE_HOUR = 16;
const MARKET_CLOSE_MINUTE = 0;

/**
 * Get the current time in Eastern timezone
 */
export function getEasternTime(): Date {
  const now = new Date();
  return new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
}

/**
 * Check if today is a weekday (Monday-Friday)
 */
export function isWeekday(date: Date = getEasternTime()): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

/**
 * Check if current time is within market hours (9:30 AM - 4:00 PM ET)
 * Note: This doesn't account for holidays - use getMarketStatus() for accurate info
 */
export function isWithinMarketHours(date: Date = getEasternTime()): boolean {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  const openMinutes = MARKET_OPEN_HOUR * 60 + MARKET_OPEN_MINUTE;
  const closeMinutes = MARKET_CLOSE_HOUR * 60 + MARKET_CLOSE_MINUTE;

  return totalMinutes >= openMinutes && totalMinutes < closeMinutes;
}

/**
 * Simple check if market is likely open (weekday + within hours)
 * For accurate status including holidays, use getMarketStatus()
 */
export function isMarketLikelyOpen(): boolean {
  const now = getEasternTime();
  return isWeekday(now) && isWithinMarketHours(now);
}

/**
 * Get the next market open time (approximate, doesn't account for holidays)
 */
export function getNextMarketOpen(): Date {
  const now = getEasternTime();
  const result = new Date(now);

  // If it's before market open today on a weekday, return today's open
  if (isWeekday(now) && !isWithinMarketHours(now)) {
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    const openMinutes = MARKET_OPEN_HOUR * 60 + MARKET_OPEN_MINUTE;

    if (totalMinutes < openMinutes) {
      result.setHours(MARKET_OPEN_HOUR, MARKET_OPEN_MINUTE, 0, 0);
      return result;
    }
  }

  // Otherwise, find the next weekday
  do {
    result.setDate(result.getDate() + 1);
  } while (!isWeekday(result));

  result.setHours(MARKET_OPEN_HOUR, MARKET_OPEN_MINUTE, 0, 0);
  return result;
}

/**
 * Format market open time for display
 */
export function formatMarketOpenTime(date: Date): string {
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/**
 * Fetch actual market status from Alpaca API
 * This is the most accurate method as it accounts for holidays
 */
export async function getMarketStatus(): Promise<MarketStatus> {
  // Mock mode returns a simulated status
  if (shouldUseMock()) {
    const isOpen = isMarketLikelyOpen();
    return {
      isOpen,
      nextOpen: isOpen ? null : getNextMarketOpen().toISOString(),
      nextClose: isOpen ? new Date().toISOString() : null,
      currentTime: new Date().toISOString(),
    };
  }

  const apiKey = process.env.ALPACA_API_KEY_ID;
  const secretKey = process.env.ALPACA_API_SECRET_KEY;

  if (!apiKey || !secretKey) {
    console.error("Missing Alpaca API credentials");
    // Fallback to simple calculation
    const isOpen = isMarketLikelyOpen();
    return {
      isOpen,
      nextOpen: isOpen ? null : getNextMarketOpen().toISOString(),
      nextClose: null,
      currentTime: new Date().toISOString(),
    };
  }

  try {
    const baseUrl = getTradingApiUrl();
    const response = await fetch(`${baseUrl}/v2/clock`, {
      headers: {
        "APCA-API-KEY-ID": apiKey,
        "APCA-API-SECRET-KEY": secretKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Alpaca clock API error: ${response.status}`);
    }

    const clock: AlpacaClock = await response.json();

    return {
      isOpen: clock.is_open,
      nextOpen: clock.is_open ? null : clock.next_open,
      nextClose: clock.is_open ? clock.next_close : null,
      currentTime: clock.timestamp,
    };
  } catch (error) {
    console.error("Failed to fetch market status from Alpaca:", error);
    // Fallback to simple calculation
    const isOpen = isMarketLikelyOpen();
    return {
      isOpen,
      nextOpen: isOpen ? null : getNextMarketOpen().toISOString(),
      nextClose: null,
      currentTime: new Date().toISOString(),
    };
  }
}

/**
 * Format the next market open time for display
 */
export function formatNextOpen(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();

  // Check if it's today
  if (date.toDateString() === now.toDateString()) {
    return `today at ${date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    })}`;
  }

  // Check if it's tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) {
    return `tomorrow at ${date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    })}`;
  }

  // Otherwise show full date
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
