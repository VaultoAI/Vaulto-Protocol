import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { auditHelpers } from "@/lib/onboarding/audit";
import {
  placeOrder,
  getQuote,
  getPosition,
  getMarketStatus,
  isValidEtfSymbol,
  isEtfFractionable,
  ORDER_LIMITS,
  type EtfSymbol,
  type OrderSide,
  type OrderType,
} from "@/lib/alpaca";
import { getUsdcBalance, formatUsdcAmount } from "@/lib/trading-wallet/execute-withdrawal";

/**
 * POST /api/alpaca/order
 *
 * Place an ETF order via Alpaca.
 * Validates market hours, balance, and position before submitting.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbError = requireDatabase();
    if (dbError) return dbError;
    const db = getDb();

    // Get user and trading wallet
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: { tradingWallet: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.tradingWallet || user.tradingWallet.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Trading wallet not active" },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      symbol,
      side,
      type,
      notionalUsd,
      qty,
      limitPrice,
    }: {
      symbol?: string;
      side?: string;
      type?: string;
      notionalUsd?: number;
      qty?: number;
      limitPrice?: number;
    } = body;

    // Validate required fields
    if (!symbol || !side || !type) {
      return NextResponse.json(
        { error: "Missing required fields: symbol, side, type" },
        { status: 400 }
      );
    }

    // Validate symbol
    const upperSymbol = symbol.toUpperCase();
    if (!isValidEtfSymbol(upperSymbol)) {
      return NextResponse.json(
        { error: `Invalid ETF symbol: ${symbol}. Supported: RVI, VCX` },
        { status: 400 }
      );
    }

    // Validate side
    const upperSide = side.toUpperCase();
    if (upperSide !== "BUY" && upperSide !== "SELL") {
      return NextResponse.json(
        { error: "Invalid side. Must be BUY or SELL" },
        { status: 400 }
      );
    }

    // Validate type
    const upperType = type.toUpperCase();
    if (upperType !== "MARKET" && upperType !== "LIMIT") {
      return NextResponse.json(
        { error: "Invalid order type. Must be MARKET or LIMIT" },
        { status: 400 }
      );
    }

    // Validate amount
    if (!notionalUsd && !qty) {
      return NextResponse.json(
        { error: "Must specify either notionalUsd or qty" },
        { status: 400 }
      );
    }

    // Check if ETF is fractionable
    const isFractionable = isEtfFractionable(upperSymbol);

    // For non-fractionable ETFs, convert to whole share orders
    let orderQty = qty;
    let orderNotional = notionalUsd;

    if (!isFractionable) {
      // If qty provided, ensure it's a whole number
      if (qty !== undefined) {
        if (!Number.isInteger(qty)) {
          return NextResponse.json(
            {
              error: `${upperSymbol} does not support fractional shares. Please enter a whole number of shares.`,
            },
            { status: 400 }
          );
        }
        if (qty < 1) {
          return NextResponse.json(
            {
              error: `Minimum order is 1 share for ${upperSymbol}`,
            },
            { status: 400 }
          );
        }
      }

      // If notionalUsd provided, convert to whole shares
      if (notionalUsd !== undefined && qty === undefined) {
        const quote = await getQuote(upperSymbol as EtfSymbol);
        const priceForCalc = upperSide === "BUY" ? quote.askPrice : quote.bidPrice;

        // Calculate whole shares (floor for conservative estimate)
        const wholeShares = Math.floor(notionalUsd / priceForCalc);

        if (wholeShares < 1) {
          return NextResponse.json(
            {
              error: `Insufficient amount for 1 share. ${upperSymbol} requires at least $${priceForCalc.toFixed(2)} per share.`,
              minAmount: priceForCalc,
            },
            { status: 400 }
          );
        }

        // Switch to qty-based order
        orderQty = wholeShares;
        orderNotional = undefined;
      }
    }

    // Check market status
    const marketStatus = await getMarketStatus();
    if (!marketStatus.isOpen) {
      return NextResponse.json(
        {
          error: "Market is closed",
          nextOpen: marketStatus.nextOpen,
        },
        { status: 400 }
      );
    }

    // For buy orders, check USDC balance
    if (upperSide === "BUY") {
      const balanceBigInt = await getUsdcBalance(
        user.tradingWallet.address as `0x${string}`,
        user.tradingWallet.chainId
      );
      const balanceUsd = parseFloat(formatUsdcAmount(balanceBigInt));

      // Get current quote to estimate order cost
      const quote = await getQuote(upperSymbol as EtfSymbol);
      const estimatedCost = notionalUsd
        ? notionalUsd
        : (qty || 0) * quote.askPrice;

      if (estimatedCost > balanceUsd) {
        return NextResponse.json(
          {
            error: "Insufficient balance",
            required: estimatedCost,
            available: balanceUsd,
          },
          { status: 400 }
        );
      }
    }

    // For sell orders, check position
    if (upperSide === "SELL") {
      const position = await getPosition(upperSymbol as EtfSymbol);

      if (!position || position.qty <= 0) {
        return NextResponse.json(
          { error: `No ${upperSymbol} position to sell` },
          { status: 400 }
        );
      }

      // If selling by quantity, validate minimum and check we have enough
      if (qty) {
        if (qty < ORDER_LIMITS.MIN_QTY) {
          return NextResponse.json(
            {
              error: `Sell quantity too small. Minimum is ${ORDER_LIMITS.MIN_QTY} shares`,
            },
            { status: 400 }
          );
        }

        if (qty > position.qty) {
          return NextResponse.json(
            {
              error: "Insufficient position",
              requested: qty,
              available: position.qty,
            },
            { status: 400 }
          );
        }
      }

      // If selling by notional, estimate quantity needed
      if (notionalUsd) {
        const quote = await getQuote(upperSymbol as EtfSymbol);
        // For limit orders, use limit price; otherwise use bid price
        const priceForEstimate = upperType === "LIMIT" && limitPrice
          ? limitPrice
          : quote.bidPrice;
        const estimatedQty = notionalUsd / priceForEstimate;

        // Check minimum quantity
        if (estimatedQty < ORDER_LIMITS.MIN_QTY) {
          return NextResponse.json(
            {
              error: `Sell amount too small. Minimum quantity is ${ORDER_LIMITS.MIN_QTY} shares`,
            },
            { status: 400 }
          );
        }

        if (estimatedQty > position.qty) {
          return NextResponse.json(
            {
              error: "Insufficient position for this sell amount",
              requestedNotional: notionalUsd,
              positionValue: position.marketValue,
            },
            { status: 400 }
          );
        }
      }
    }

    // Create order record in database
    const clientOrderId = `vaulto-${user.id}-${Date.now()}`;
    const etfOrder = await db.etfOrder.create({
      data: {
        tradingWalletId: user.tradingWallet.id,
        clientOrderId,
        symbol: upperSymbol,
        side: upperSide,
        type: upperType,
        notionalUsd: orderNotional || null,
        qty: orderQty || null,
        limitPrice: limitPrice || null,
        status: "PENDING",
      },
    });

    // Place order with Alpaca
    const result = await placeOrder({
      symbol: upperSymbol as EtfSymbol,
      side: upperSide as OrderSide,
      type: upperType as OrderType,
      notional: orderNotional,
      qty: orderQty,
      limitPrice,
      clientOrderId,
    });

    if (!result.success || !result.order) {
      // Update order status to rejected
      await db.etfOrder.update({
        where: { id: etfOrder.id },
        data: {
          status: "REJECTED",
          statusMessage: result.error || "Order rejected by Alpaca",
        },
      });

      // Log rejection
      await auditHelpers.etfOrderRejected(
        user.id,
        etfOrder.id,
        {
          symbol: upperSymbol,
          side: upperSide,
          reason: result.error || "Order rejected by Alpaca",
        },
        request.headers.get("x-forwarded-for") || undefined
      );

      return NextResponse.json(
        { error: result.error || "Order placement failed" },
        { status: 400 }
      );
    }

    // Update order with Alpaca response
    const alpacaOrder = result.order;
    const isFilled = alpacaOrder.status === "filled";

    await db.etfOrder.update({
      where: { id: etfOrder.id },
      data: {
        alpacaOrderId: alpacaOrder.id,
        status: isFilled ? "FILLED" : "SUBMITTED",
        submittedAt: new Date(alpacaOrder.submitted_at),
        filledAt: isFilled && alpacaOrder.filled_at ? new Date(alpacaOrder.filled_at) : null,
        filledQty: alpacaOrder.filled_qty ? parseFloat(alpacaOrder.filled_qty) : 0,
        filledAvgPrice: alpacaOrder.filled_avg_price
          ? parseFloat(alpacaOrder.filled_avg_price)
          : null,
      },
    });

    // Update or create position if filled
    if (isFilled && alpacaOrder.filled_avg_price && alpacaOrder.filled_qty) {
      const filledQty = parseFloat(alpacaOrder.filled_qty);
      const filledPrice = parseFloat(alpacaOrder.filled_avg_price);

      const existingPosition = await db.etfPosition.findUnique({
        where: {
          tradingWalletId_symbol: {
            tradingWalletId: user.tradingWallet.id,
            symbol: upperSymbol,
          },
        },
      });

      if (upperSide === "BUY") {
        if (existingPosition) {
          // Update existing position
          const newQty = existingPosition.qty.toNumber() + filledQty;
          const newCostBasis = existingPosition.costBasis.toNumber() + filledQty * filledPrice;
          const newAvgPrice = newCostBasis / newQty;

          await db.etfPosition.update({
            where: { id: existingPosition.id },
            data: {
              qty: newQty,
              costBasis: newCostBasis,
              avgEntryPrice: newAvgPrice,
              currentPrice: filledPrice,
              marketValue: newQty * filledPrice,
              lastSyncedAt: new Date(),
            },
          });
        } else {
          // Create new position
          await db.etfPosition.create({
            data: {
              tradingWalletId: user.tradingWallet.id,
              symbol: upperSymbol,
              qty: filledQty,
              costBasis: filledQty * filledPrice,
              avgEntryPrice: filledPrice,
              currentPrice: filledPrice,
              marketValue: filledQty * filledPrice,
              lastSyncedAt: new Date(),
            },
          });
        }
      } else if (upperSide === "SELL" && existingPosition) {
        // Reduce position
        const newQty = existingPosition.qty.toNumber() - filledQty;

        if (newQty <= 0) {
          // Delete position if fully sold
          await db.etfPosition.delete({
            where: { id: existingPosition.id },
          });
        } else {
          // Update position with reduced quantity
          const proportionRemaining = newQty / existingPosition.qty.toNumber();
          const newCostBasis = existingPosition.costBasis.toNumber() * proportionRemaining;

          await db.etfPosition.update({
            where: { id: existingPosition.id },
            data: {
              qty: newQty,
              costBasis: newCostBasis,
              currentPrice: filledPrice,
              marketValue: newQty * filledPrice,
              unrealizedPl: newQty * filledPrice - newCostBasis,
              lastSyncedAt: new Date(),
            },
          });
        }
      }

      // Log fill
      await auditHelpers.etfOrderFilled(
        user.id,
        etfOrder.id,
        {
          symbol: upperSymbol,
          side: upperSide,
          filledQty,
          filledAvgPrice: filledPrice,
          alpacaOrderId: alpacaOrder.id,
        },
        request.headers.get("x-forwarded-for") || undefined
      );
    } else {
      // Log placement
      await auditHelpers.etfOrderPlaced(
        user.id,
        etfOrder.id,
        {
          symbol: upperSymbol,
          side: upperSide,
          type: upperType,
          notionalUsd: orderNotional,
          qty: orderQty,
          alpacaOrderId: alpacaOrder.id,
        },
        request.headers.get("x-forwarded-for") || undefined
      );
    }

    return NextResponse.json({
      success: true,
      order: {
        id: etfOrder.id,
        alpacaOrderId: alpacaOrder.id,
        symbol: upperSymbol,
        side: upperSide,
        type: upperType,
        status: isFilled ? "FILLED" : "SUBMITTED",
        notionalUsd: orderNotional,
        qty: orderQty,
        filledQty: alpacaOrder.filled_qty ? parseFloat(alpacaOrder.filled_qty) : 0,
        filledAvgPrice: alpacaOrder.filled_avg_price
          ? parseFloat(alpacaOrder.filled_avg_price)
          : null,
      },
    });
  } catch (error) {
    console.error("[Alpaca Order] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to place order" },
      { status: 500 }
    );
  }
}
