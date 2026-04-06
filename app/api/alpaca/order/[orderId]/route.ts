import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { auditHelpers } from "@/lib/onboarding/audit";
import { getOrder, cancelOrder } from "@/lib/alpaca";

interface RouteParams {
  params: Promise<{ orderId: string }>;
}

/**
 * GET /api/alpaca/order/[orderId]
 *
 * Get order status by ID.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbError = requireDatabase();
    if (dbError) return dbError;
    const db = getDb();

    const { orderId } = await params;

    // Get order from database
    const etfOrder = await db.etfOrder.findUnique({
      where: { id: orderId },
      include: {
        tradingWallet: {
          include: { user: true },
        },
      },
    });

    if (!etfOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Verify ownership
    if (etfOrder.tradingWallet.user.email !== session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // If order is pending/submitted, sync with Alpaca
    if (
      etfOrder.alpacaOrderId &&
      (etfOrder.status === "PENDING" || etfOrder.status === "SUBMITTED")
    ) {
      const alpacaOrder = await getOrder(etfOrder.alpacaOrderId);

      if (alpacaOrder) {
        // Map Alpaca status to our status
        type EtfStatus = "PENDING" | "SUBMITTED" | "PARTIALLY_FILLED" | "FILLED" | "CANCELED" | "REJECTED" | "EXPIRED";
        let newStatus: EtfStatus = etfOrder.status as EtfStatus;
        if (alpacaOrder.status === "filled") {
          newStatus = "FILLED";
        } else if (alpacaOrder.status === "partially_filled") {
          newStatus = "PARTIALLY_FILLED";
        } else if (alpacaOrder.status === "canceled") {
          newStatus = "CANCELED";
        } else if (alpacaOrder.status === "rejected") {
          newStatus = "REJECTED";
        } else if (alpacaOrder.status === "expired") {
          newStatus = "EXPIRED";
        }

        // Update if status changed
        if (newStatus !== etfOrder.status) {
          const previousFilledQty = etfOrder.filledQty.toNumber();
          const newFilledQty = alpacaOrder.filled_qty
            ? parseFloat(alpacaOrder.filled_qty)
            : previousFilledQty;
          const newFilledAvgPrice = alpacaOrder.filled_avg_price
            ? parseFloat(alpacaOrder.filled_avg_price)
            : etfOrder.filledAvgPrice?.toNumber() || null;

          await db.etfOrder.update({
            where: { id: etfOrder.id },
            data: {
              status: newStatus,
              filledQty: newFilledQty,
              filledAvgPrice: newFilledAvgPrice,
              filledAt:
                alpacaOrder.filled_at && newStatus === "FILLED"
                  ? new Date(alpacaOrder.filled_at)
                  : etfOrder.filledAt,
            },
          });

          // Update position if new shares were filled
          const additionalFilledQty = newFilledQty - previousFilledQty;
          if (additionalFilledQty > 0 && newFilledAvgPrice) {
            const existingPosition = await db.etfPosition.findUnique({
              where: {
                tradingWalletId_symbol: {
                  tradingWalletId: etfOrder.tradingWalletId,
                  symbol: etfOrder.symbol,
                },
              },
            });

            if (etfOrder.side === "BUY") {
              if (existingPosition) {
                // Update existing position
                const oldQty = existingPosition.qty.toNumber();
                const newQty = oldQty + additionalFilledQty;
                const newCostBasis = existingPosition.costBasis.toNumber() + additionalFilledQty * newFilledAvgPrice;
                const newAvgPrice = newCostBasis / newQty;

                await db.etfPosition.update({
                  where: { id: existingPosition.id },
                  data: {
                    qty: newQty,
                    costBasis: newCostBasis,
                    avgEntryPrice: newAvgPrice,
                    currentPrice: newFilledAvgPrice,
                    marketValue: newQty * newFilledAvgPrice,
                    lastSyncedAt: new Date(),
                  },
                });
              } else {
                // Create new position
                await db.etfPosition.create({
                  data: {
                    tradingWalletId: etfOrder.tradingWalletId,
                    symbol: etfOrder.symbol,
                    qty: additionalFilledQty,
                    costBasis: additionalFilledQty * newFilledAvgPrice,
                    avgEntryPrice: newFilledAvgPrice,
                    currentPrice: newFilledAvgPrice,
                    marketValue: additionalFilledQty * newFilledAvgPrice,
                    lastSyncedAt: new Date(),
                  },
                });
              }
            } else if (etfOrder.side === "SELL" && existingPosition) {
              // Reduce position
              const oldQty = existingPosition.qty.toNumber();
              const newQty = oldQty - additionalFilledQty;

              if (newQty <= 0) {
                // Delete position if fully sold
                await db.etfPosition.delete({
                  where: { id: existingPosition.id },
                });
              } else {
                // Update position with reduced quantity
                const proportionRemaining = newQty / oldQty;
                const newCostBasis = existingPosition.costBasis.toNumber() * proportionRemaining;

                await db.etfPosition.update({
                  where: { id: existingPosition.id },
                  data: {
                    qty: newQty,
                    costBasis: newCostBasis,
                    currentPrice: newFilledAvgPrice,
                    marketValue: newQty * newFilledAvgPrice,
                    unrealizedPl: newQty * newFilledAvgPrice - newCostBasis,
                    lastSyncedAt: new Date(),
                  },
                });
              }
            }

            // Log the fill
            await auditHelpers.etfOrderFilled(
              etfOrder.tradingWallet.user.id,
              etfOrder.id,
              {
                symbol: etfOrder.symbol,
                side: etfOrder.side,
                filledQty: additionalFilledQty,
                filledAvgPrice: newFilledAvgPrice,
                alpacaOrderId: etfOrder.alpacaOrderId || undefined,
              },
              request.headers.get("x-forwarded-for") || undefined
            );
          }

          etfOrder.status = newStatus as typeof etfOrder.status;
        }
      }
    }

    return NextResponse.json({
      id: etfOrder.id,
      alpacaOrderId: etfOrder.alpacaOrderId,
      symbol: etfOrder.symbol,
      side: etfOrder.side,
      type: etfOrder.type,
      status: etfOrder.status,
      statusMessage: etfOrder.statusMessage,
      notionalUsd: etfOrder.notionalUsd?.toNumber(),
      qty: etfOrder.qty?.toNumber(),
      limitPrice: etfOrder.limitPrice?.toNumber(),
      filledQty: etfOrder.filledQty.toNumber(),
      filledAvgPrice: etfOrder.filledAvgPrice?.toNumber(),
      createdAt: etfOrder.createdAt.toISOString(),
      submittedAt: etfOrder.submittedAt?.toISOString(),
      filledAt: etfOrder.filledAt?.toISOString(),
    });
  } catch (error) {
    console.error("[Alpaca Order Status] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch order" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/alpaca/order/[orderId]
 *
 * Cancel a pending order.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbError = requireDatabase();
    if (dbError) return dbError;
    const db = getDb();

    const { orderId } = await params;

    // Get order from database
    const etfOrder = await db.etfOrder.findUnique({
      where: { id: orderId },
      include: {
        tradingWallet: {
          include: { user: true },
        },
      },
    });

    if (!etfOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Verify ownership
    if (etfOrder.tradingWallet.user.email !== session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Check if order can be canceled
    if (etfOrder.status !== "PENDING" && etfOrder.status !== "SUBMITTED") {
      return NextResponse.json(
        { error: `Cannot cancel order with status: ${etfOrder.status}` },
        { status: 400 }
      );
    }

    // Cancel with Alpaca if submitted
    if (etfOrder.alpacaOrderId) {
      const canceled = await cancelOrder(etfOrder.alpacaOrderId);

      if (!canceled) {
        return NextResponse.json(
          { error: "Failed to cancel order with Alpaca" },
          { status: 500 }
        );
      }
    }

    // Update order status
    await db.etfOrder.update({
      where: { id: etfOrder.id },
      data: {
        status: "CANCELED",
        statusMessage: "Canceled by user",
      },
    });

    // Log cancellation
    await auditHelpers.etfOrderCanceled(
      etfOrder.tradingWallet.user.id,
      etfOrder.id,
      {
        symbol: etfOrder.symbol,
        side: etfOrder.side,
        reason: "Canceled by user",
        alpacaOrderId: etfOrder.alpacaOrderId || undefined,
      },
      request.headers.get("x-forwarded-for") || undefined
    );

    return NextResponse.json({ success: true, status: "CANCELED" });
  } catch (error) {
    console.error("[Alpaca Order Cancel] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel order" },
      { status: 500 }
    );
  }
}
